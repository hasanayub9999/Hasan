using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

/// Owns every cube in the world. The builder edits it; the drone's A* planner reads it
/// (the drone has full knowledge of the map). Placed objects live in <see cref="props"/>
/// and are saved alongside the cubes.
public class CellMap : MonoBehaviour
{
    public static CellMap Instance { get; private set; }

    public Material wallMaterial;
    public Material winMaterial;
    public Material invisibleMaterial;
    public PropSet props;
    public Vector3Int droneStart = new Vector3Int(1, 1, 1);

    readonly Dictionary<Vector3Int, Cell> cells = new Dictionary<Vector3Int, Cell>();
    bool registryBuilt;
    bool showInvisible = true;

    public static string SavePath => Path.Combine(Application.persistentDataPath, "drone_map.json");
    public int Count { get { EnsureRegistry(); return cells.Count; } }
    public IEnumerable<KeyValuePair<Vector3Int, Cell>> Cells { get { EnsureRegistry(); return cells; } }

    /// Draw invisible walls as faint ghosts (Build mode) or not at all (while running).
    public bool ShowInvisible
    {
        get => showInvisible;
        set
        {
            if (showInvisible == value) return;
            showInvisible = value;
            EnsureRegistry();
            foreach (var c in cells.Values) ApplyVisibility(c);
        }
    }

    void Awake()
    {
        Instance = this;
        RebuildRegistry();
    }

    void EnsureRegistry()
    {
        if (!registryBuilt) RebuildRegistry();
    }

    public void RebuildRegistry()
    {
        cells.Clear();
        foreach (var c in GetComponentsInChildren<Cell>(true))
            cells[c.Coord] = c;
        registryBuilt = true;
    }

    public Cell Get(Vector3Int coord)
    {
        EnsureRegistry();
        cells.TryGetValue(coord, out var c);
        return c;
    }

    public Cell Place(Vector3Int coord, CellType type, bool invisible = false)
    {
        EnsureRegistry();
        if (cells.TryGetValue(coord, out var existing))
        {
            if (existing.type == type) return existing;
            Remove(coord);
        }

        var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
        go.name = $"{type} {coord.x},{coord.y},{coord.z}";
        go.transform.SetParent(transform, false);
        go.transform.position = coord;
        var rend = go.GetComponent<Renderer>();
        // The win cube is the terminal cell: a see-through trigger the drone flies into.
        if (type == CellType.Win) rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        go.GetComponent<BoxCollider>().isTrigger = type == CellType.Win;
        go.isStatic = Application.isPlaying == false;

        var cell = go.AddComponent<Cell>();
        cell.type = type;
        cell.invisible = invisible && type == CellType.Wall;
        cells[coord] = cell;
        ApplyVisibility(cell);
        return cell;
    }

    public bool Remove(Vector3Int coord)
    {
        EnsureRegistry();
        if (!cells.TryGetValue(coord, out var c)) return false;
        cells.Remove(coord);
        if (c != null) DestroyAny(c.gameObject);
        return true;
    }

    public void Clear()
    {
        for (int i = transform.childCount - 1; i >= 0; i--)
            DestroyAny(transform.GetChild(i).gameObject);
        cells.Clear();
        registryBuilt = true;
    }

    static void DestroyAny(GameObject go)
    {
        if (Application.isPlaying) Destroy(go);
        else DestroyImmediate(go);
    }

    // ---------- invisible walls ----------

    /// Walls only: the win cube is already see-through and must stay visible as the target.
    public void SetInvisible(Vector3Int coord, bool value)
    {
        var c = Get(coord);
        if (c == null || c.type != CellType.Wall || c.invisible == value) return;
        c.invisible = value;
        ApplyVisibility(c);
    }

    void ApplyVisibility(Cell c)
    {
        if (c == null) return;
        var rend = c.GetComponent<Renderer>();
        if (c.type == CellType.Win)
        {
            rend.sharedMaterial = winMaterial;
            rend.enabled = true;
            return;
        }
        // Colliders are left alone either way, so invisible walls stay solid for A*.
        rend.sharedMaterial = c.invisible ? invisibleMaterial : wallMaterial;
        rend.shadowCastingMode = c.invisible
            ? UnityEngine.Rendering.ShadowCastingMode.Off
            : UnityEngine.Rendering.ShadowCastingMode.On;
        rend.enabled = !c.invisible || showInvisible;
    }

    // ---------- save / load ----------

    [Serializable]
    class MapData
    {
        public Vector3Int start;
        public List<Vector3Int> walls = new List<Vector3Int>();
        public List<Vector3Int> wins = new List<Vector3Int>();
        public List<Vector3Int> invisible = new List<Vector3Int>();
        public List<PropSet.PropData> props = new List<PropSet.PropData>();
    }

    public void Save()
    {
        EnsureRegistry();
        var data = new MapData { start = droneStart };
        foreach (var kv in cells)
        {
            (kv.Value.type == CellType.Win ? data.wins : data.walls).Add(kv.Key);
            if (kv.Value.invisible) data.invisible.Add(kv.Key);
        }
        if (props) data.props = props.Export();
        File.WriteAllText(SavePath, JsonUtility.ToJson(data));
        Debug.Log($"[Map] Saved {cells.Count} cubes, {data.props.Count} objects to {SavePath}");
    }

    public bool Load()
    {
        if (!File.Exists(SavePath))
        {
            Debug.LogWarning($"[Map] No saved map at {SavePath}");
            return false;
        }
        var data = JsonUtility.FromJson<MapData>(File.ReadAllText(SavePath));
        Clear();
        var hidden = new HashSet<Vector3Int>(data.invisible ?? new List<Vector3Int>());
        foreach (var p in data.walls) Place(p, CellType.Wall, hidden.Contains(p));
        foreach (var p in data.wins) Place(p, CellType.Win);
        droneStart = data.start;
        if (props) props.Import(data.props);
        Debug.Log($"[Map] Loaded {cells.Count} cubes from {SavePath}");
        return true;
    }

    /// Removes every cube and every placed object.
    public void ClearAll()
    {
        Clear();
        if (props) props.Clear();
    }
}
