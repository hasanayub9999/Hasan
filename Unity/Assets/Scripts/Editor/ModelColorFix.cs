using UnityEditor;
using UnityEditor.AssetImporters;
using UnityEngine;

/// Kenney's Nature Kit FBX files store sRGB diffuse colors, which Unity's importer brightens a
/// second time (washed-out trees). Undo that so the colors match the kit's previews.
/// Runs after URP's own material description preprocessor, which sets _BaseColor.
class ModelColorFix : AssetPostprocessor
{
    public override uint GetVersion() => 2;
    public override int GetPostprocessOrder() => 100;

    void OnPreprocessMaterialDescription(MaterialDescription description, Material material, AnimationClip[] clips)
    {
        if (!assetPath.StartsWith("Assets/Models/Nature/")) return;
        if (material.HasProperty("_BaseColor"))
            material.SetColor("_BaseColor", material.GetColor("_BaseColor").linear);
    }
}
