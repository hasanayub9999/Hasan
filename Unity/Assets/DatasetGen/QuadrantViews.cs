using UnityEngine;

/// Camera poses for photographing the parking lot one quadrant at a time from straight above.
/// Shared by the YOLO dataset generator and (later) the drone scanner, so scan photos match
/// the training data. Image "up" is world +Z (north) and image "right" is world +X (east).
public static class QuadrantViews
{
    [System.Serializable]
    public struct Settings
    {
        [Tooltip("Meters each frame reaches past its quadrant into the neighbouring quadrants.")]
        public float overlap;
        [Tooltip("Meters each frame reaches past the outer edge of the lot.")]
        public float outerMargin;
        [Tooltip("Vertical field of view in degrees (Unity Camera.fieldOfView).")]
        public float verticalFov;
        [Tooltip("Image width / height.")]
        public float aspect;
        [Tooltip("World Y of the asphalt surface.")]
        public float groundY;

        public static Settings Default => new Settings
        {
            overlap = 2.5f, outerMargin = 1f, verticalFov = 55f, aspect = 4f / 3f, groundY = -0.5f
        };
    }

    public struct View
    {
        public int index;            // 0 = SW, 1 = SE, 2 = NW, 3 = NE (x varies fastest)
        public Rect groundRect;      // x/z footprint (x = world X, y = world Z) guaranteed to be in frame
        public float altitude;       // camera height above the ground
        public Vector3 position;
        public Quaternion rotation;  // looking straight down, image up = +Z
    }

    public static readonly string[] Names = { "SW", "SE", "NW", "NE" };

    /// One view per quadrant. Each frame covers its quadrant plus the overlap/outer margins,
    /// at the lowest altitude that still fits that rectangle (maximum detail).
    public static View[] Compute(Vector2Int quadrants, Vector2 quadSize, Settings s)
    {
        var views = new View[quadrants.x * quadrants.y];
        float tanV = Mathf.Tan(s.verticalFov * 0.5f * Mathf.Deg2Rad);
        float tanH = tanV * s.aspect;
        var down = Quaternion.LookRotation(Vector3.down, Vector3.forward);

        for (int qz = 0; qz < quadrants.y; qz++)
            for (int qx = 0; qx < quadrants.x; qx++)
            {
                float xMin = qx * quadSize.x - (qx == 0 ? s.outerMargin : s.overlap);
                float xMax = (qx + 1) * quadSize.x + (qx == quadrants.x - 1 ? s.outerMargin : s.overlap);
                float zMin = qz * quadSize.y - (qz == 0 ? s.outerMargin : s.overlap);
                float zMax = (qz + 1) * quadSize.y + (qz == quadrants.y - 1 ? s.outerMargin : s.overlap);
                var rect = Rect.MinMaxRect(xMin, zMin, xMax, zMax);

                float altitude = Mathf.Max(rect.width * 0.5f / tanH, rect.height * 0.5f / tanV);
                int i = qz * quadrants.x + qx;
                views[i] = new View
                {
                    index = i,
                    groundRect = rect,
                    altitude = altitude,
                    position = new Vector3(rect.center.x, s.groundY + altitude, rect.center.y),
                    rotation = down,
                };
            }
        return views;
    }

    /// Ground point (y = groundY) seen at pixel (u, v) of a W x H photo taken from `view`, with v
    /// measured from the top of the image. This is how a YOLO box center becomes a 3D target.
    public static Vector3 PixelToGround(View view, Settings s, float u, float v, int width, int height)
    {
        float fy = height * 0.5f / Mathf.Tan(s.verticalFov * 0.5f * Mathf.Deg2Rad);
        var dirCam = new Vector3((u - width * 0.5f) / fy, -(v - height * 0.5f) / fy, 1f);
        var dir = view.rotation * dirCam;
        float t = (s.groundY - view.position.y) / dir.y;
        return view.position + dir * t;
    }
}
