using System.Collections.Generic;
using UnityEngine;

/// The drone: plans a route to the win cube with A* over the cell map, then flies it
/// one cell at a time. It wins when it arrives inside the (see-through) win cube.
[RequireComponent(typeof(Rigidbody), typeof(BoxCollider))]
public class Drone : MonoBehaviour
{
    public enum State { Idle, Following, Arrived, NoPath }

    [Header("Motion")]
    public float cellsPerSecond = 4f;

    [Header("Visuals")]
    public bool showPath = true;
    public Material pathMaterial;
    public Material trailMaterial;

    public State Status { get; private set; } = State.Idle;
    public bool Running { get; private set; }
    public AStarPlanner.Result Plan { get; private set; }
    public int Steps => pathIndex;
    public int PathSteps => Plan != null && Plan.found ? Plan.path.Count - 1 : 0;

    LineRenderer pathLine;
    TrailRenderer trail;
    int pathIndex;              // index into Plan.path of the cell we're currently at
    bool moving;
    Vector3 moveTarget;

    float HalfSize => transform.localScale.x * 0.5f;

    void Awake()
    {
        var rb = GetComponent<Rigidbody>();
        rb.isKinematic = true;
        rb.useGravity = false;
        gameObject.layer = 2; // Ignore Raycast: keeps the drone out of the builder's mouse rays

        var lineGo = new GameObject("Planned Path");
        lineGo.transform.SetParent(transform, false);
        pathLine = lineGo.AddComponent<LineRenderer>();
        pathLine.useWorldSpace = true;
        pathLine.widthMultiplier = 0.06f;
        pathLine.sharedMaterial = pathMaterial;
        pathLine.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        pathLine.positionCount = 0;

        trail = gameObject.AddComponent<TrailRenderer>();
        trail.time = 100000f;
        trail.minVertexDistance = 0.1f;
        trail.widthMultiplier = 0.08f;
        trail.sharedMaterial = trailMaterial;
        trail.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
    }

    /// Teleport to a cell and forget any plan.
    public void ResetTo(Vector3Int cell)
    {
        Running = false;
        moving = false;
        Status = State.Idle;
        Plan = null;
        pathIndex = 0;
        transform.position = cell;
        if (trail != null) trail.Clear();
        if (pathLine != null) pathLine.positionCount = 0;
    }

    /// Plan with A* from the current cell, then start flying.
    public void Run()
    {
        var start = Vector3Int.RoundToInt(transform.position);
        Plan = AStarPlanner.FindPath(CellMap.Instance, start);
        pathIndex = 0;
        moving = false;

        if (!Plan.found)
        {
            Status = State.NoPath;
            Running = false;
            pathLine.positionCount = 0;
            Debug.Log($"[Drone] NO PATH ({Plan.failReason}) after expanding {Plan.expanded} nodes");
            if (SimulationManager.Instance != null) SimulationManager.Instance.OnDroneGaveUp();
            return;
        }

        Debug.Log($"[Drone] A* path: {PathSteps} moves, {Plan.expanded} nodes expanded, {Plan.milliseconds:0.00} ms");
        pathLine.positionCount = Plan.path.Count;
        for (int i = 0; i < Plan.path.Count; i++) pathLine.SetPosition(i, Plan.path[i]);
        Status = State.Following;
        Running = true;
    }

    public void Halt() { Running = false; }

    void Update()
    {
        if (pathLine != null) pathLine.enabled = showPath;

        var sim = SimulationManager.Instance;
        if (!Running || (sim != null && sim.Paused)) return;

        // Spend this frame's movement budget; at high speed several cells may be crossed per frame.
        float budget = cellsPerSecond * Time.deltaTime;
        while (budget > 0f && Running)
        {
            if (!moving)
            {
                if (pathIndex >= Plan.path.Count - 1) { Arrive(); break; }
                moveTarget = Plan.path[pathIndex + 1];
                moving = true;
            }

            float remaining = Vector3.Distance(transform.position, moveTarget);
            float step = Mathf.Min(budget, remaining);
            transform.position = Vector3.MoveTowards(transform.position, moveTarget, step);
            budget -= step;

            if (Vector3.Distance(transform.position, moveTarget) < 1e-4f)
            {
                transform.position = moveTarget;
                trail.AddPosition(moveTarget); // keeps corners sharp when several cells pass per frame
                moving = false;
                pathIndex++;
            }
        }
    }

    /// End of the path: confirm we're physically inside a win cube.
    void Arrive()
    {
        Running = false;
        foreach (var c in Physics.OverlapBox(transform.position, Vector3.one * HalfSize, Quaternion.identity, ~0, QueryTriggerInteraction.Collide))
        {
            var cell = c.GetComponent<Cell>();
            if (cell != null && cell.type == CellType.Win)
            {
                Status = State.Arrived;
                Debug.Log($"[Drone] WIN after {Steps} moves (A* expanded {Plan.expanded} nodes)");
                if (SimulationManager.Instance != null) SimulationManager.Instance.OnDroneWon();
                return;
            }
        }
        Status = State.NoPath;
        Debug.LogWarning("[Drone] Reached end of path but no win cube here");
        if (SimulationManager.Instance != null) SimulationManager.Instance.OnDroneGaveUp();
    }

    // Scene view: cells A* expanded (closed set) and the chosen path.
    void OnDrawGizmos()
    {
        if (Plan == null) return;
        Gizmos.color = new Color(0.3f, 0.6f, 1f, 0.35f);
        foreach (var c in Plan.closed) Gizmos.DrawCube(c, Vector3.one * 0.25f);
        Gizmos.color = Color.yellow;
        for (int i = 1; i < Plan.path.Count; i++) Gizmos.DrawLine(Plan.path[i - 1], Plan.path[i]);
    }
}
