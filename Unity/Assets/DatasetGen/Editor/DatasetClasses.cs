using System.Collections.Generic;

/// YOLO class list for the drone item detector. The ORDER IS PERMANENT: trained models and
/// existing labels refer to these indices. Only ever append new classes at the end.
public static class DatasetClasses
{
    /// (YOLO class name, prop catalog entry name)
    static readonly (string yolo, string catalog)[] Classes =
    {
        ("phone",        "Phone"),         // 0
        ("keys",         "Keys"),          // 1
        ("wallet",       "Wallet"),        // 2
        ("laptop",       "Laptop"),        // 3
        ("purse",        "Purse"),         // 4
        ("backpack",     "Backpack"),      // 5
        ("headphones",   "Headphones"),    // 6
        ("umbrella",     "Umbrella"),      // 7
        ("water_bottle", "Water bottle"),  // 8
        ("soda_can",     "Soda can"),      // 9
        ("coffee_cup",   "Coffee cup"),    // 10
    };

    static Dictionary<string, int> byCatalog;

    public static int Count => Classes.Length;
    public static string Name(int id) => Classes[id].yolo;
    public static string CatalogName(int id) => Classes[id].catalog;

    /// Class id for a prop catalog name, or -1 if that prop is not a detection target.
    public static int FromCatalog(string catalogName)
    {
        if (byCatalog == null)
        {
            byCatalog = new Dictionary<string, int>();
            for (int i = 0; i < Classes.Length; i++) byCatalog[Classes[i].catalog] = i;
        }
        return catalogName != null && byCatalog.TryGetValue(catalogName, out int id) ? id : -1;
    }
}
