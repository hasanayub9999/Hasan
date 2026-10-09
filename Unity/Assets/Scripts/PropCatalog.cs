using System;
using System.Collections.Generic;
using UnityEngine;

/// The placeable objects shown in the builder's Objects panel. Filled by Drone Sim/Build Parking Lot Scene.
[CreateAssetMenu(menuName = "Drone Sim/Prop Catalog")]
public class PropCatalog : ScriptableObject
{
    [Serializable]
    public class Entry
    {
        public string name;
        public GameObject prefab;
        [Tooltip("Largest dimension in meters (1 grid cell = 1 m); the model is scaled to match.")]
        public float size = 1f;
        [Tooltip("Applied to the model first, e.g. to lay a phone modelled upright flat on the ground.")]
        public Vector3 modelRotation;
    }

    public List<Entry> entries = new List<Entry>();

    public int Count => entries.Count;
    public Entry Get(int index) => index >= 0 && index < entries.Count ? entries[index] : null;
    public int IndexOf(string name) => entries.FindIndex(e => e.name == name);
}
