// --- START OF FILE data.js ---

const rawData = {
    names: [
        "Aeloria", "Aethelis", "Aulora", "Bhoma", "Bolor", "Borgon", "Borum", "Brakk", "Brundo", "Celyra", "Cymira", "Czin", 
        "Dhoro", "Dhugo", "Dhurom", "Dhuul", "Dhuvo", "Drogath", "Druug", "Elisen", "Elora", "Faelar", "Ghol", "Ghor-Rak", 
        "Ghul-Zog", "Gorthak", "Gron", "Illian", "Iluvia", "Ithyra", "Khargul", "Kharzhak", "Kragoth", "Krazhak", "Kromm", 
        "Kruz", "Kurzan", "Liriel", "Lyrae", "Maelis", "Moro", "Morob", "Mubor", "Mumbor", "Myriel", "Nymira", "Olon", 
        "Omoa", "Omuru", "Onor", "Orom", "Oseira", "Phelaris", "Qazra", "Qen", "Qix", "Qixal", "Rak-Shur", "Rhokul", 
        "Rhyse", "Skarr", "Solael", "Sselix", "Ssenar", "Ssharra", "Sszeth", "Syllara", "Sylphen", "Szikra", "Taleal", 
        "Targ", "Tzeth", "Tzikal", "Tzik-Tzok", "Tzira", "Tzoc", "Ubor", "Ulon", "Umba", "Uth", "Uudam", "Vaeliria", 
        "Valori", "Vozrak", "Vragh", "Vrokk", "Xarax", "Xeneth", "Xilox", "Xylar", "Xylox", "Xyra", "Zakh", "Zar-Gath", 
        "Zareth", "Zetzal", "Zharr", "Zixal", "Zixis", "Zorakh"
    ],
    rareProperties: ["Pollution", "Electromagnetic interference", "Luminescent crystals"],
    size: ["Dwarf", "Small", "Standard", "Large", "Massive"],
    gravity: ["Microgravity", "Low gravity", "Earth gravity", "High gravity", "Dangerously high gravity"],
    humidity: ["Desert", "Arid", "Dry", "Temperate", "Humid", "Wet", "Oceanic"],
    weather: ["Mild", "Windy", "Stormy", "Volcanic", "Frozen", "Scorching", "Pleasant", "Dusty", "Dark", "Cool", "Foggy", "Warm", "Clear"],
    lifeDensity: ["Barren", "Sparse", "Moderate", "Thriving", "Encroaching", "Dense"],
    technology: ["Stone age", "Bronze age", "Medieval", "Combustion Mechanics", "Electrical", "Early space", "Spacefaring", "Advanced space-age"],
    baseBiology: ["Warm blooded", "Cold blooded", "Exoskeletal", "Invertebrate", "Silicon-based", "Robotic"],
    biologyDetail1: ["Aquatic", "Avian", "Sub-terrestrial", "Tall", "Stout"],
    biologyDetail2IF: ["Psionic", "Multi-Limbed", "Mute", "Athletic", "Strong", "Intelligent", "Detached"],
    government: ["Republic", "Hive-mind", "Hereditary Royalty", "Acracy", "Anarchy", "Oligarchy", "Communist", "Free Market", "Theocracy"],
    coreValue: ["Unity", "Freedom", "Brotherhood", "Strength", "Tribalism", "Conquest", "Wealth", "Materialism", "Faith"],
    flawIF: ["Violent", "Naive", "Racist", "Cannibalism", "Amoral toward outsiders"]
};

export function getRandomListEntry(listName) {
    const list = rawData[listName];
    return list[Math.floor(Math.random() * list.length)];
}

export function getExclusionaryName(gameState) {
    if (!gameState.availableNames) {
        gameState.availableNames = [...rawData.names]; // Initialize pool if empty
    }
    if (gameState.availableNames.length === 0) {
        return `Sector-${Math.floor(Math.random() * 9999)}`; // Fallback if out of names
    }
    const index = Math.floor(Math.random() * gameState.availableNames.length);
    const name = gameState.availableNames[index];
    gameState.availableNames.splice(index, 1); // Remove from pool permanently
    return name;
}