using UnityEngine;

public enum CellType { Wall, Win }

/// One 1x1x1 grid cube in the map.
public class Cell : MonoBehaviour
{
    public CellType type;
    /// Hidden but still solid: ghosted in Build mode, not drawn while the drone runs.
    public bool invisible;

    public Vector3Int Coord => Vector3Int.RoundToInt(transform.position);
}
