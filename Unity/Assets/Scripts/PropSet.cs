using System;
using System.Collections.Generic;
using UnityEngine;

/// Owns every placed object. Saved and loaded together with the cubes by <see cref="CellMap"/>.
public class PropSet : MonoBehaviour
{
    public PropCatalog catalog;

    [Serializable]
    public class PropData
    {
        public string name;
        public Vector3 position;
        public float yaw;
    }

    /// Places catalog entry `index` with its base centered on `pos`, turned `yaw` degrees.
    public Prop Place(int index, Vector3 pos, float yaw)
    {
        var entry = catalog ? catalog.Get(index) : null;
        if (entry == null || entry.prefab == null) return null;

        var root = Build(entry);
        root.transform.SetParent(transform, false);
        root.transform.SetPositionAndRotation(pos, Quaternion.Euler(0f, yaw, 0f));
        // Colliders are only for mouse picking (Ctrl+LMB remove, stacking objects).
        foreach (var mf in root.GetComponentsInChildren<MeshFilter>())
            if (mf.sharedMesh != null && mf.GetComponent<Collider>() == null)
                mf.gameObject.AddComponent<MeshCollider>().sharedMesh = mf.sharedMesh;

        var prop = root.AddComponent<Prop>();
        prop.entryName = entry.name;
        return prop;
    }

    /// An upright instance scaled to the entry's real-world size, under an empty pivot at its base center.
    public static GameObject Build(PropCatalog.Entry entry)
    {
        var root = new GameObject(entry.name);
        var model = Instantiate(entry.prefab, root.transform, false);
        model.name = entry.prefab.name;
        model.transform.localRotation = Quaternion.Euler(entry.modelRotation) * model.transform.localRotation;

        if (RendererBounds(model, out var b))
        {
            float largest = Mathf.Max(b.size.x, b.size.y, b.size.z);
            if (largest > 1e-5f) model.transform.localScale *= entry.size / largest;
            RendererBounds(model, out b);
            model.transform.localPosition -= new Vector3(b.center.x, b.min.y, b.center.z);
        }
        return root;
    }

    public static bool RendererBounds(GameObject go, out Bounds bounds)
    {
        bounds = default;
        bool any = false;
        foreach (var r in go.GetComponentsInChildren<Renderer>())
        {
            if (!any) { bounds = r.bounds; any = true; }
            else bounds.Encapsulate(r.bounds);
        }
        return any;
    }

    public void Remove(Prop prop)
    {
        if (prop == null) return;
        prop.transform.SetParent(null, false);
        DestroyAny(prop.gameObject);
    }

    public void Clear()
    {
        // Detach first: Destroy is deferred in Play mode, and Export/Count must not see the old objects.
        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            var child = transform.GetChild(i);
            child.SetParent(null, false);
            DestroyAny(child.gameObject);
        }
    }

    public int Count => GetComponentsInChildren<Prop>().Length;

    public List<PropData> Export()
    {
        var list = new List<PropData>();
        foreach (var p in GetComponentsInChildren<Prop>())
            list.Add(new PropData { name = p.entryName, position = p.transform.position, yaw = p.transform.eulerAngles.y });
        return list;
    }

    public void Import(List<PropData> data)
    {
        Clear();
        if (data == null || catalog == null) return;
        foreach (var d in data)
        {
            int index = catalog.IndexOf(d.name);
            if (index < 0) Debug.LogWarning($"[Props] Unknown object '{d.name}' in save, skipped");
            else Place(index, d.position, d.yaw);
        }
    }

    static void DestroyAny(GameObject go)
    {
        if (Application.isPlaying) Destroy(go);
        else DestroyImmediate(go);
    }
}
