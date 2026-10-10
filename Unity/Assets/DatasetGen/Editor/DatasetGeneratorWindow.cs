using UnityEditor;
using UnityEngine;

/// Drone Sim/Dataset/Generate YOLO Dataset…: settings, start/stop and live status for DatasetGenerator.
public class DatasetGeneratorWindow : EditorWindow
{
    [SerializeField] DatasetSettings settings = new DatasetSettings();
    SerializedObject so;
    Vector2 scroll;

    [MenuItem("Drone Sim/Dataset/Generate YOLO Dataset…")]
    static void Open() => GetWindow<DatasetGeneratorWindow>("YOLO Dataset");

    [MenuItem("Drone Sim/Dataset/Open Dataset Folder")]
    static void OpenFolder()
    {
        var path = new DatasetSettings().OutputPath;
        System.IO.Directory.CreateDirectory(path);
        EditorUtility.RevealInFinder(path);
    }

    void OnEnable() => so = new SerializedObject(this);

    void OnGUI()
    {
        so.Update();
        scroll = EditorGUILayout.BeginScrollView(scroll);
        EditorGUILayout.HelpBox(
            "Each environment: re-randomize the lot, photograph the 4 quadrants from above, write YOLO labels for the 11 item classes.\n" +
            "Output goes outside Assets. Existing environments are skipped, so a stopped run can be resumed.",
            MessageType.Info);

        using (new EditorGUI.DisabledScope(DatasetGenerator.IsRunning))
            EditorGUILayout.PropertyField(so.FindProperty("settings"), true);
        so.ApplyModifiedProperties();

        EditorGUILayout.Space();
        EditorGUILayout.LabelField("Output", settings.OutputPath, EditorStyles.wordWrappedMiniLabel);
        EditorGUILayout.LabelField("Status", DatasetGenerator.Status, EditorStyles.wordWrappedLabel);

        EditorGUILayout.Space();
        if (DatasetGenerator.IsRunning)
        {
            if (GUILayout.Button("Stop", GUILayout.Height(28))) DatasetGenerator.Stop();
        }
        else if (GUILayout.Button($"Generate {settings.environments} environments ({settings.environments * 4} images)", GUILayout.Height(28)))
        {
            DatasetGenerator.Start(settings);
        }
        EditorGUILayout.EndScrollView();
    }

    void Update()
    {
        if (DatasetGenerator.IsRunning) Repaint();
    }
}
