using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

/// Settings for one dataset run. Defaults match the agreed format (see Tools/yolo/README.md).
[Serializable]
public class DatasetSettings
{
    public string outputDir = "Datasets/drone_items";   // relative to the project folder, or absolute
    public int environments = 1000;
    public int startIndex = 0;
    public int baseSeed = 1000;

    [Header("Camera")]
    public int width = 4032, height = 3024;
    public QuadrantViews.Settings views = QuadrantViews.Settings.Default;
    [Range(50, 100)] public int jpgQuality = 95;

    [Header("Scene variety")]
    public bool randomizeLighting = true;
    public int scatterMinPerQuadrant = 2, scatterMaxPerQuadrant = 6;
    [Range(0f, 1f)] public float backgroundChance = 0.05f;

    [Header("Label filters")]
    public int minVisiblePixels = 12;
    [Range(0f, 1f)] public float minVisibleFraction = 0.3f;
    [Range(0f, 1f)] public float minInFrameFraction = 0.5f;

    public string OutputPath => Path.IsPathRooted(outputDir)
        ? outputDir
        : Path.GetFullPath(Path.Combine(Application.dataPath, "..", outputDir));
}

/// Generates a YOLO (Ultralytics detect) dataset from the parking-lot scene: for every environment
/// it re-randomizes the lot, photographs the 4 quadrants from above (QuadrantViews) and writes
/// images/, labels/ and meta/ per split. Runs incrementally from EditorApplication.update in the
/// Editor (one image per tick, cancellable), or synchronously from the command line.
public static class DatasetGenerator
{
    public const string Version = "1.0";
    const string ScenePath = "Assets/Scenes/ParkingLot.unity";

    static Job job;
    static int progressId;

    public static bool IsRunning => job != null;
    public static string Status { get; private set; } = "Idle";

    // ---------- Editor (incremental) ----------

    public static void Start(DatasetSettings settings)
    {
        if (job != null) { Debug.LogWarning("[Dataset] Already running."); return; }
        if (EditorApplication.isPlaying) { Debug.LogWarning("[Dataset] Exit Play mode first."); return; }
        if (!Application.isBatchMode && !EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;

        try
        {
            job = new Job(settings);
            job.Begin();
        }
        catch (Exception e)
        {
            Debug.LogError("[Dataset] Could not start: " + e.Message);
            job?.End(false);
            job = null;
            return;
        }

        progressId = Progress.Start("YOLO dataset", $"{job.TotalImages} images → {settings.OutputPath}");
        Progress.RegisterCancelCallback(progressId, () => { Stop(); return true; });
        EditorApplication.update += Tick;
    }

    public static void Stop()
    {
        if (job != null) job.stopRequested = true;
    }

    static void Tick()
    {
        bool more;
        try
        {
            more = !job.stopRequested && job.Step();
        }
        catch (Exception e)
        {
            Debug.LogException(e);
            more = false;
        }
        Status = job.StatusText;
        if (Progress.Exists(progressId))
            Progress.Report(progressId, job.DoneImages, Mathf.Max(1, job.TotalImages), job.StatusText);
        if (more) return;

        EditorApplication.update -= Tick;
        bool cancelled = job.stopRequested;
        job.End(true);
        Status = job.StatusText;
        if (Progress.Exists(progressId))
            Progress.Finish(progressId, cancelled ? Progress.Status.Canceled : Progress.Status.Succeeded);
        job = null;
    }

    // ---------- Command line (synchronous) ----------

    /// unity run "C:\Unity Projects\Drone" -- -executeMethod DatasetGenerator.RunFromCommandLine
    ///     -envs 1000 [-start 0] [-seed 1000] [-out Datasets/drone_items]
    /// Needs graphics (do not pass -nographics).
    public static void RunFromCommandLine()
    {
        var s = new DatasetSettings();
        var args = Environment.GetCommandLineArgs();
        for (int i = 0; i < args.Length - 1; i++)
        {
            switch (args[i])
            {
                case "-envs": s.environments = int.Parse(args[i + 1]); break;
                case "-start": s.startIndex = int.Parse(args[i + 1]); break;
                case "-seed": s.baseSeed = int.Parse(args[i + 1]); break;
                case "-out": s.outputDir = args[i + 1]; break;
            }
        }

        int exitCode = 0;
        try
        {
            EditorSceneManager.OpenScene(ScenePath);
            var j = new Job(s);
            j.Begin();
            while (j.Step())
                if (j.DoneImages % 20 == 0) Debug.Log("[Dataset] " + j.StatusText);
            j.End(false);
        }
        catch (Exception e)
        {
            Debug.LogException(e);
            exitCode = 1;
        }
        if (Application.isBatchMode) EditorApplication.Exit(exitCode);
    }

    // ---------- the job ----------

    class Job
    {
        public bool stopRequested;
        public int TotalImages => envs.Count * views.Length;
        public int DoneImages { get; private set; }
        public string StatusText { get; private set; } = "Starting";

        readonly DatasetSettings s;
        string root, scenePath;
        LotRandomizer randomizer;
        PropSet props;
        Light sun;
        UniversalRenderPipelineAsset urp;
        float oldShadowDistance;
        QuadrantViews.View[] views;
        List<int> envs;
        int envCursor, quadrant;
        double startTime;

        GameObject camGo;
        Camera cam;
        UniversalAdditionalCameraData camData;
        RenderTexture rgbRT, maskRT;
        Texture2D rgbTex, maskTex;
        Shader idShader;
        Material blackMat;
        readonly List<Material> idMats = new List<Material>();

        // per environment
        readonly List<Prop> items = new List<Prop>();
        readonly List<int> itemClass = new List<int>();
        LightInfo lightInfo;
        int envSeed;

        public Job(DatasetSettings settings) { s = settings; }

        public void Begin()
        {
            randomizer = UnityEngine.Object.FindAnyObjectByType<LotRandomizer>();
            if (randomizer == null || randomizer.props == null || randomizer.props.catalog == null)
                throw new Exception("Open the ParkingLot scene (it needs a LotRandomizer with a PropSet and catalog).");
            props = randomizer.props;
            scenePath = SceneManagerActivePath();
            foreach (var l in UnityEngine.Object.FindObjectsByType<Light>(FindObjectsInactive.Exclude, FindObjectsSortMode.None))
                if (l.type == LightType.Directional) { sun = l; break; }

            root = s.OutputPath;
            foreach (var split in new[] { "train", "val", "test" })
                foreach (var kind in new[] { "images", "labels", "meta" })
                    Directory.CreateDirectory(Path.Combine(root, kind, split));

            s.views.aspect = (float)s.width / s.height;
            views = QuadrantViews.Compute(randomizer.quadrants, randomizer.quadSize, s.views);

            // Resume: skip environments whose 4 label files already exist (labels are written last).
            envs = new List<int>();
            for (int e = s.startIndex; e < s.startIndex + s.environments; e++)
            {
                string split = SplitOf(e);
                bool done = Enumerable.Range(0, views.Length)
                    .All(q => File.Exists(Path.Combine(root, "labels", split, Stem(e, q) + ".txt")));
                if (!done) envs.Add(e);
            }

            urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp != null)
            {
                oldShadowDistance = urp.shadowDistance;
                urp.shadowDistance = Mathf.Max(oldShadowDistance, views.Max(v => v.altitude) * 2.5f);
            }

            camGo = new GameObject("Dataset Capture Camera") { hideFlags = HideFlags.HideAndDontSave };
            cam = camGo.AddComponent<Camera>();
            cam.enabled = false;
            cam.fieldOfView = s.views.verticalFov;
            cam.aspect = (float)s.width / s.height;
            cam.nearClipPlane = 0.3f;
            cam.farClipPlane = 500f;
            camData = cam.GetUniversalAdditionalCameraData();

            rgbRT = new RenderTexture(s.width, s.height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB) { antiAliasing = 1 };
            maskRT = new RenderTexture(s.width, s.height, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear) { antiAliasing = 1, filterMode = FilterMode.Point };
            rgbRT.Create();
            maskRT.Create();
            rgbTex = new Texture2D(s.width, s.height, TextureFormat.RGB24, false, false);
            maskTex = new Texture2D(s.width, s.height, TextureFormat.RGBA32, false, true);

            idShader = Shader.Find("Hidden/DatasetGen/Id");
            if (idShader == null) throw new Exception("Shader Hidden/DatasetGen/Id not found.");
            blackMat = IdMaterial(0);

            WriteDataYaml();
            startTime = EditorApplication.timeSinceStartup;
            StatusText = envs.Count == 0 ? "Nothing to do: all environments already exist" : $"0 / {TotalImages}";
            Debug.Log($"[Dataset] {envs.Count} environments to generate ({s.environments - envs.Count} already done) → {root}");
        }

        /// One image per call. Returns false when finished.
        public bool Step()
        {
            if (envCursor >= envs.Count) return false;
            int env = envs[envCursor];
            if (quadrant == 0) SetupEnvironment(env);
            Capture(env, quadrant);
            DoneImages++;

            double elapsed = EditorApplication.timeSinceStartup - startTime;
            double eta = elapsed / DoneImages * (TotalImages - DoneImages);
            StatusText = $"env {env} q{quadrant}  {DoneImages} / {TotalImages}  ({elapsed / DoneImages:0.0} s/img, ~{eta / 60:0} min left)";

            if (++quadrant >= views.Length) { quadrant = 0; envCursor++; }
            return envCursor < envs.Count;
        }

        public void End(bool reopenScene)
        {
            if (urp != null) urp.shadowDistance = oldShadowDistance;
            if (camGo) UnityEngine.Object.DestroyImmediate(camGo);
            foreach (var rt in new[] { rgbRT, maskRT }) if (rt) { rt.Release(); UnityEngine.Object.DestroyImmediate(rt); }
            foreach (var t in new[] { rgbTex, maskTex }) if (t) UnityEngine.Object.DestroyImmediate(t);
            foreach (var m in idMats) if (m) UnityEngine.Object.DestroyImmediate(m);

            if (root != null) WriteManifest();
            StatusText = $"{(stopRequested ? "Stopped" : "Done")}: {DoneImages} images written to {root}";
            Debug.Log("[Dataset] " + StatusText);

            // Throw away the generated layouts: put the user's saved scene back.
            if (reopenScene && !string.IsNullOrEmpty(scenePath))
                EditorSceneManager.OpenScene(scenePath);
        }

        // ---------- environment ----------

        void SetupEnvironment(int env)
        {
            envSeed = s.baseSeed + env;
            randomizer.Randomize(envSeed);
            var rng = new System.Random(envSeed * 7919 + 17);

            // Scatter extra items anywhere on the asphalt so the model doesn't learn "items only next to cars".
            var carBounds = new List<Bounds>();
            foreach (var p in props.GetComponentsInChildren<Prop>())
                if (Array.IndexOf(randomizer.carNames, p.entryName) >= 0 && PropSet.RendererBounds(p.gameObject, out var b))
                {
                    b.Expand(new Vector3(0.6f, 0f, 0.6f));
                    carBounds.Add(b);
                }
            var itemIds = new List<int>();
            for (int c = 0; c < DatasetClasses.Count; c++)
            {
                int idx = props.catalog.IndexOf(DatasetClasses.CatalogName(c));
                if (idx >= 0) itemIds.Add(idx);
            }
            var q = randomizer.quadSize;
            for (int qz = 0; qz < randomizer.quadrants.y; qz++)
                for (int qx = 0; qx < randomizer.quadrants.x; qx++)
                {
                    int n = rng.Next(s.scatterMinPerQuadrant, s.scatterMaxPerQuadrant + 1);
                    for (int i = 0; i < n && itemIds.Count > 0; i++)
                        for (int attempt = 0; attempt < 20; attempt++)
                        {
                            var pos = new Vector3(qx * q.x + 1f + (float)rng.NextDouble() * (q.x - 2f), s.views.groundY,
                                                  qz * q.y + 1f + (float)rng.NextDouble() * (q.y - 2f));
                            if (carBounds.Any(cb => cb.Contains(new Vector3(pos.x, cb.center.y, pos.z)))) continue;
                            props.Place(itemIds[rng.Next(itemIds.Count)], pos, (float)rng.NextDouble() * 360f);
                            break;
                        }
                }

            // Occasionally empty a quadrant completely (background images).
            for (int qz = 0; qz < randomizer.quadrants.y; qz++)
                for (int qx = 0; qx < randomizer.quadrants.x; qx++)
                {
                    if (rng.NextDouble() >= s.backgroundChance) continue;
                    var core = new Rect(qx * q.x, qz * q.y, q.x, q.y);
                    foreach (var p in props.GetComponentsInChildren<Prop>())
                        if (DatasetClasses.FromCatalog(p.entryName) >= 0 && core.Contains(new Vector2(p.transform.position.x, p.transform.position.z)))
                            props.Remove(p);
                }

            // Lighting
            lightInfo = new LightInfo();
            if (sun != null && s.randomizeLighting)
            {
                lightInfo.elevation = 30f + (float)rng.NextDouble() * 50f;
                lightInfo.azimuth = (float)rng.NextDouble() * 360f;
                lightInfo.intensity = 0.8f + (float)rng.NextDouble() * 0.6f;
                lightInfo.temperature = 5000f + (float)rng.NextDouble() * 2000f;
                sun.transform.rotation = Quaternion.Euler(lightInfo.elevation, lightInfo.azimuth, 0f);
                sun.intensity = lightInfo.intensity;
                sun.color = Mathf.CorrelatedColorTemperatureToRGB(lightInfo.temperature);
            }
            else if (sun != null)
            {
                var e = sun.transform.eulerAngles;
                lightInfo.elevation = e.x;
                lightInfo.azimuth = e.y;
                lightInfo.intensity = sun.intensity;
            }

            // Everything that gets an id this environment (index + 1 = mask id)
            items.Clear();
            itemClass.Clear();
            foreach (var p in props.GetComponentsInChildren<Prop>())
            {
                int cls = DatasetClasses.FromCatalog(p.entryName);
                if (cls < 0) continue;
                items.Add(p);
                itemClass.Add(cls);
            }
            if (items.Count > 510) throw new Exception("More than 510 items in one environment; the id mask can't encode them.");
        }

        // ---------- one photo ----------

        void Capture(int env, int qIndex)
        {
            var view = views[qIndex];
            camGo.transform.SetPositionAndRotation(view.position, view.rotation);
            string split = SplitOf(env), stem = Stem(env, qIndex);

            // RGB
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.allowHDR = true;
            cam.allowMSAA = true;
            camData.renderPostProcessing = true;
            camData.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            camData.antialiasingQuality = AntialiasingQuality.High;
            Render(rgbRT);
            ReadInto(rgbRT, rgbTex);
            string imagePath = Path.Combine(root, "images", split, stem + ".jpg");
            WriteAtomic(imagePath, rgbTex.EncodeToJPG(s.jpgQuality));

            // Label masks: (1) everything rendered, so occluders hide items; (2) items only.
            var visible = new PixelStats[items.Count + 1];
            var unoccluded = new PixelStats[items.Count + 1];
            RenderMask(itemsOnly: false, visible);
            RenderMask(itemsOnly: true, unoccluded);

            // Labels + meta
            var meta = new ImageMeta
            {
                env = env, seed = envSeed, quadrant = qIndex, quadrantName = QuadrantViews.Names[Mathf.Min(qIndex, 3)],
                split = split, image = stem + ".jpg", width = s.width, height = s.height,
                verticalFov = s.views.verticalFov, groundY = s.views.groundY,
                cameraPosition = view.position, cameraRotation = view.rotation, groundRect = view.groundRect,
                light = lightInfo,
            };
            float fy = s.height * 0.5f / Mathf.Tan(s.views.verticalFov * 0.5f * Mathf.Deg2Rad);
            meta.fx = meta.fy = fy;
            meta.cx = s.width * 0.5f;
            meta.cy = s.height * 0.5f;

            var labels = new StringBuilder();
            for (int i = 0; i < items.Count; i++)
            {
                var vis = visible[i + 1];
                var full = unoccluded[i + 1];
                float inFrame = InFrameFraction(items[i], out bool projected);
                if (!projected || (full.count == 0 && inFrame <= 0f)) continue; // not in this photo at all

                var im = new ItemMeta
                {
                    classId = itemClass[i], className = DatasetClasses.Name(itemClass[i]), catalogName = items[i].entryName,
                    worldPosition = items[i].transform.position, yaw = items[i].transform.eulerAngles.y,
                    visiblePixels = vis.count, unoccludedPixels = full.count,
                    visibleFraction = full.count > 0 ? (float)vis.count / full.count : 0f,
                    inFrameFraction = inFrame,
                };
                if (vis.count > 0) im.bbox = new[] { (float)vis.minX, vis.minY, vis.maxX + 1, vis.maxY + 1 };

                if (vis.count < s.minVisiblePixels) im.reason = "too few visible pixels";
                else if (im.visibleFraction < s.minVisibleFraction) im.reason = "occluded";
                else if (inFrame < s.minInFrameFraction) im.reason = "cut off by frame";
                else
                {
                    im.labeled = true;
                    float x1 = vis.minX, y1 = vis.minY, x2 = vis.maxX + 1, y2 = vis.maxY + 1;
                    labels.Append(itemClass[i]).Append(' ')
                          .Append(F((x1 + x2) * 0.5f / s.width)).Append(' ')
                          .Append(F((y1 + y2) * 0.5f / s.height)).Append(' ')
                          .Append(F((x2 - x1) / s.width)).Append(' ')
                          .Append(F((y2 - y1) / s.height)).Append('\n');
                }
                meta.items.Add(im);
            }

            WriteAtomic(Path.Combine(root, "meta", split, stem + ".json"), Encoding.UTF8.GetBytes(JsonUtility.ToJson(meta, true)));
            // Written last: its existence marks the image as complete (used for resuming).
            WriteAtomic(Path.Combine(root, "labels", split, stem + ".txt"), Encoding.UTF8.GetBytes(labels.ToString()));
        }

        struct PixelStats { public int count, minX, minY, maxX, maxY; }

        void RenderMask(bool itemsOnly, PixelStats[] stats)
        {
            var itemIndex = new Dictionary<Renderer, int>();
            for (int i = 0; i < items.Count; i++)
                foreach (var r in items[i].GetComponentsInChildren<Renderer>())
                    itemIndex[r] = i + 1;

            var renderers = UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
            var savedMats = new Material[renderers.Length][];
            var savedEnabled = new bool[renderers.Length];
            try
            {
                for (int i = 0; i < renderers.Length; i++)
                {
                    var r = renderers[i];
                    savedMats[i] = r.sharedMaterials;
                    savedEnabled[i] = r.enabled;
                    bool isItem = itemIndex.TryGetValue(r, out int id);
                    if (itemsOnly && !isItem) { r.enabled = false; continue; }
                    var mat = isItem ? IdMaterial(id) : blackMat;
                    var mats = new Material[Mathf.Max(1, savedMats[i].Length)];
                    for (int m = 0; m < mats.Length; m++) mats[m] = mat;
                    r.sharedMaterials = mats;
                }

                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = Color.black;
                cam.allowHDR = false;
                // URP's MSAA would blend id colors along object edges and decode as other items' ids.
                cam.allowMSAA = false;
                camData.renderPostProcessing = false;
                camData.antialiasing = AntialiasingMode.None;
                Render(maskRT);
                ReadInto(maskRT, maskTex);
            }
            finally
            {
                for (int i = 0; i < renderers.Length; i++)
                {
                    if (renderers[i] == null) continue;
                    renderers[i].sharedMaterials = savedMats[i];
                    renderers[i].enabled = savedEnabled[i];
                }
            }

            for (int i = 0; i < stats.Length; i++) stats[i] = new PixelStats { minX = int.MaxValue, minY = int.MaxValue, maxX = -1, maxY = -1 };
            var px = maskTex.GetPixelData<Color32>(0);
            int w = s.width, h = s.height;
            for (int row = 0; row < h; row++)
            {
                int y = h - 1 - row; // texture rows start at the bottom, image rows at the top
                int o = row * w;
                for (int x = 0; x < w; x++)
                {
                    var c = px[o + x];
                    if (c.r < 16 && c.g < 16 && c.b < 16) continue;
                    if (!IsPureLevel(c.r) || !IsPureLevel(c.g) || !IsPureLevel(c.b)) { blendedPixels++; continue; }
                    int id = Level(c.r) + 8 * Level(c.g) + 64 * Level(c.b);
                    if (id <= 0 || id >= stats.Length) { unknownIdPixels++; continue; }
                    ref var st = ref stats[id];
                    st.count++;
                    if (x < st.minX) st.minX = x;
                    if (x > st.maxX) st.maxX = x;
                    if (y < st.minY) st.minY = y;
                    if (y > st.maxY) st.maxY = y;
                }
            }
            if (unknownIdPixels > 0 && !warnedUnknown)
            {
                warnedUnknown = true;
                Debug.LogWarning($"[Dataset] {unknownIdPixels} mask pixels decoded to unknown ids (color round-trip issue?)");
            }
        }

        int unknownIdPixels;
        bool warnedUnknown;

        static int Level(byte v) => Mathf.RoundToInt(v / 255f * 7f);

        /// True if the channel sits on one of the 8 exact id levels (anything else is a blended edge pixel).
        static bool IsPureLevel(byte v)
        {
            float x = v / 255f * 7f;
            return Mathf.Abs(x - Mathf.Round(x)) < 0.15f;
        }

        int blendedPixels;

        Material IdMaterial(int id)
        {
            while (idMats.Count <= id)
            {
                int k = idMats.Count;
                var m = new Material(idShader) { hideFlags = HideFlags.HideAndDontSave };
                m.SetVector("_IdColor", new Vector4((k % 8) / 7f, (k / 8 % 8) / 7f, (k / 64 % 8) / 7f, 1f));
                idMats.Add(m);
            }
            return idMats[id];
        }

        /// Share of the item's projected mesh (vertex bounding box) that lands inside the photo.
        float InFrameFraction(Prop item, out bool projected)
        {
            float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;
            projected = false;
            foreach (var mf in item.GetComponentsInChildren<MeshFilter>())
            {
                var mesh = mf.sharedMesh;
                if (mesh == null) continue;
                Vector3[] verts;
                try { verts = mesh.isReadable ? mesh.vertices : null; } catch { verts = null; }
                if (verts == null) verts = Corners(mesh.bounds);
                var m = mf.transform.localToWorldMatrix;
                foreach (var v in verts)
                {
                    var vp = cam.WorldToViewportPoint(m.MultiplyPoint3x4(v));
                    if (vp.z <= 0f) continue;
                    projected = true;
                    float x = vp.x * s.width, y = (1f - vp.y) * s.height;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
            if (!projected) return 0f;
            float area = Mathf.Max(1e-3f, (maxX - minX) * (maxY - minY));
            float cw = Mathf.Max(0f, Mathf.Min(maxX, s.width) - Mathf.Max(minX, 0f));
            float ch = Mathf.Max(0f, Mathf.Min(maxY, s.height) - Mathf.Max(minY, 0f));
            return Mathf.Clamp01(cw * ch / area);
        }

        static Vector3[] Corners(Bounds b)
        {
            var c = new Vector3[8];
            for (int i = 0; i < 8; i++)
                c[i] = b.center + Vector3.Scale(b.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
            return c;
        }

        void Render(RenderTexture target)
        {
            var request = new RenderPipeline.StandardRequest { destination = target };
            if (RenderPipeline.SupportsRenderRequest(cam, request))
                RenderPipeline.SubmitRenderRequest(cam, request);
            else
            {
                cam.targetTexture = target;
                cam.Render();
                cam.targetTexture = null;
            }
        }

        static void ReadInto(RenderTexture rt, Texture2D tex)
        {
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            tex.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0, false);
            tex.Apply(false);
            RenderTexture.active = prev;
        }

        // ---------- files ----------

        void WriteDataYaml()
        {
            var sb = new StringBuilder();
            sb.AppendLine("# Drone parking-lot item detector (generated by DatasetGenerator " + Version + ")");
            sb.AppendLine("path: " + root.Replace('\\', '/'));
            sb.AppendLine("train: images/train");
            sb.AppendLine("val: images/val");
            sb.AppendLine("test: images/test");
            sb.AppendLine("names:");
            for (int i = 0; i < DatasetClasses.Count; i++) sb.AppendLine($"  {i}: {DatasetClasses.Name(i)}");
            File.WriteAllText(Path.Combine(root, "data.yaml"), sb.ToString());
        }

        void WriteManifest()
        {
            var m = new Manifest
            {
                generatorVersion = Version,
                updated = DateTime.Now.ToString("s"),
                settings = s,
                classes = Enumerable.Range(0, DatasetClasses.Count).Select(DatasetClasses.Name).ToArray(),
            };
            var perClass = new int[DatasetClasses.Count];
            foreach (var split in new[] { "train", "val", "test" })
            {
                var c = new SplitCounts { split = split };
                var dir = Path.Combine(root, "labels", split);
                if (Directory.Exists(dir))
                    foreach (var f in Directory.GetFiles(dir, "*.txt"))
                    {
                        c.images++;
                        int lines = 0;
                        foreach (var line in File.ReadLines(f))
                        {
                            int sp = line.IndexOf(' ');
                            if (sp > 0 && int.TryParse(line.Substring(0, sp), out int cls) && cls >= 0 && cls < perClass.Length)
                            {
                                perClass[cls]++;
                                lines++;
                            }
                        }
                        c.objects += lines;
                        if (lines == 0) c.backgroundImages++;
                    }
                m.splits.Add(c);
            }
            m.objectsPerClass = perClass;
            File.WriteAllText(Path.Combine(root, "dataset.json"), JsonUtility.ToJson(m, true));
        }

        static void WriteAtomic(string path, byte[] data)
        {
            string tmp = path + ".tmp";
            File.WriteAllBytes(tmp, data);
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmp, path);
        }

        static string F(float v) => Mathf.Clamp01(v).ToString("0.000000", System.Globalization.CultureInfo.InvariantCulture);
        static string SceneManagerActivePath() => UnityEngine.SceneManagement.SceneManager.GetActiveScene().path;
    }

    // ---------- shared helpers ----------

    public static string Stem(int env, int quadrant) => $"env{env:00000}_q{quadrant}";

    /// Deterministic 80 / 15 / 5 split by environment, so all 4 views of a lot share a split.
    public static string SplitOf(int env)
    {
        uint h = (uint)env * 2654435761u;
        h ^= h >> 16;
        int bucket = (int)(h % 100);
        return bucket < 80 ? "train" : bucket < 95 ? "val" : "test";
    }

    // ---------- JSON shapes ----------

    [Serializable]
    class LightInfo
    {
        public float elevation, azimuth, intensity, temperature;
    }

    [Serializable]
    class ItemMeta
    {
        public int classId;
        public string className, catalogName;
        public Vector3 worldPosition;
        public float yaw;
        public bool labeled;
        public string reason = "";
        public float[] bbox = new float[0];   // x1, y1, x2, y2 in pixels (visible part), empty if not visible
        public int visiblePixels, unoccludedPixels;
        public float visibleFraction, inFrameFraction;
    }

    [Serializable]
    class ImageMeta
    {
        public int env, seed, quadrant;
        public string quadrantName, split, image;
        public int width, height;
        public float verticalFov, fx, fy, cx, cy, groundY;
        public Vector3 cameraPosition;
        public Quaternion cameraRotation;
        public Rect groundRect;
        public LightInfo light;
        public List<ItemMeta> items = new List<ItemMeta>();
    }

    [Serializable]
    class SplitCounts
    {
        public string split;
        public int images, objects, backgroundImages;
    }

    [Serializable]
    class Manifest
    {
        public string generatorVersion, updated;
        public string[] classes;
        public DatasetSettings settings;
        public List<SplitCounts> splits = new List<SplitCounts>();
        public int[] objectsPerClass;
    }
}
