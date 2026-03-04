
(function () {
    'use strict';
  
    const STORAGE_KEY = 'skribblAutoGuesserSettings_v1';
    const WORD_CACHE_KEY = 'skribblAutoGuesserWordCache_v1';
    const DEFAULT_SETTINGS = {
      delayMs: 1000,
      dotPrefix: true,
      panelX: null,
      panelY: null,
      panelWidth: 320,
      panelHeight: null,
      collapsed: false,
      corner: 'top-right',
      refreshRateMs: 100,
      closeHitScanMs: 20,
      devPanelOpen: false,
      devPanelX: null,
      devPanelY: null,
      detailsCollapsed: false,
      devPanelWidth: 300,
      devPanelHeight: 420,
    };

    const PANEL_SIZE = { minWidth: 260, minHeight: 200, maxWidth: 1400, maxHeight: 1200 };
    const DEV_PANEL_SIZE = { minWidth: 260, minHeight: 280, maxWidth: 1000, maxHeight: 1200 };
    const SCRIPT_VERSION = 'v1.0.0';
  
    const LIMITS = {
      delayMin: 0,
      delayMax: 8000,
      candidatePreview: 999999,
      maxRetries: 5,
      queueBurstLimit: 1200,
      spamCooldownMs: 1200,
      tickPollMs: 150,
      refreshRateMin: 50,
      refreshRateMax: 2000,
      closeHitScanMin: 10,
      closeHitScanMax: 200,
      closeHitScanTimeout: 500,
      devLogMax: 80,
      minGuessLength: 3,
    };
  
    const BUNDLED_WORDS = [
  "ABBA",
  "AC/DC",
  "Abraham Lincoln",
  "Adidas",
  "Africa",
  "Aladdin",
  "America",
  "Amsterdam",
  "Android",
  "Angelina Jolie",
  "Angry Birds",
  "Antarctica",
  "Anubis",
  "Apple",
  "Argentina",
  "Asia",
  "Asterix",
  "Atlantis",
  "Audi",
  "Australia",
  "BMW",
  "BMX",
  "Bambi",
  "Band-Aid",
  "Barack Obama",
  "Bart Simpson",
  "Batman",
  "Beethoven",
  "Bible",
  "Big Ben",
  "Bill Gates",
  "Bitcoin",
  "Black Friday",
  "Bomberman",
  "Brazil",
  "Bruce Lee",
  "Bugs Bunny",
  "Canada",
  "Capricorn",
  "Captain America",
  "Cat Woman",
  "Cerberus",
  "Charlie Chaplin",
  "Chewbacca",
  "China",
  "Chinatown",
  "Christmas",
  "Chrome",
  "Chuck Norris",
  "Colosseum",
  "Cookie Monster",
  "Crash Bandicoot",
  "Creeper",
  "Croatia",
  "Cuba",
  "Cupid",
  "DNA",
  "Daffy Duck",
  "Darwin",
  "Darwin Watterson",
  "Deadpool",
  "Dexter",
  "Discord",
  "Donald Duck",
  "Donald Trump",
  "Dora",
  "Doritos",
  "Dracula",
  "Dumbo",
  "Earth",
  "Easter",
  "Easter Bunny",
  "Egypt",
  "Eiffel tower",
  "Einstein",
  "Elmo",
  "Elon Musk",
  "Elsa",
  "Eminem",
  "England",
  "Europe",
  "Excalibur",
  "Facebook",
  "Family Guy",
  "Fanta",
  "Ferrari",
  "Finn",
  "Finn and Jake",
  "Flash",
  "Florida",
  "France",
  "Frankenstein",
  "Fred Flintstone",
  "Gandalf",
  "Gandhi",
  "Garfield",
  "Germany",
  "God",
  "Goofy",
  "Google",
  "Great Wall",
  "Greece",
  "Green Lantern",
  "Grinch",
  "Gru",
  "Gumball",
  "Happy Meal",
  "Harry Potter",
  "Hawaii",
  "Hello Kitty",
  "Hercules",
  "Hollywood",
  "Home Alone",
  "Homer Simpson",
  "Hula Hoop",
  "Hulk",
  "Ikea",
  "India",
  "Intel",
  "Ireland",
  "Iron Giant",
  "Iron Man",
  "Israel",
  "Italy",
  "Jack-o-lantern",
  "Jackie Chan",
  "James Bond",
  "Japan",
  "JayZ",
  "Jenga",
  "Jesus Christ",
  "Jimmy Neutron",
  "John Cena",
  "Johnny Bravo",
  "KFC",
  "Katy Perry",
  "Kermit",
  "Kim Jong-un",
  "King Kong",
  "Kirby",
  "Kung Fu",
  "Lady Gaga",
  "Las Vegas",
  "Lasagna",
  "Lego",
  "Leonardo DiCaprio",
  "Leonardo da Vinci",
  "Lion King",
  "London",
  "London Eye",
  "Luigi",
  "MTV",
  "Madagascar",
  "Mario",
  "Mark Zuckerberg",
  "Mars",
  "McDonalds",
  "Medusa",
  "Mercedes",
  "Mercury",
  "Mexico",
  "Michael Jackson",
  "Mickey Mouse",
  "Microsoft",
  "Milky Way",
  "Minecraft",
  "Miniclip",
  "Minion",
  "Minotaur",
  "Mona Lisa",
  "Monday",
  "Monster",
  "Mont Blanc",
  "Morgan Freeman",
  "Morse code",
  "Morty",
  "Mount Everest",
  "Mount Rushmore",
  "Mozart",
  "Mr Bean",
  "Mr Meeseeks",
  "Mr. Bean",
  "Mr. Meeseeks",
  "Mummy",
  "NASCAR",
  "Nasa",
  "Nemo",
  "Neptune",
  "Netherlands",
  "New Zealand",
  "Nike",
  "Nintendo Switch",
  "North Korea",
  "Northern Lights",
  "Norway",
  "Notch",
  "Nutella",
  "Obelix",
  "Olaf",
  "Oreo",
  "Pac-Man",
  "Paris",
  "Patrick",
  "Paypal",
  "Peppa Pig",
  "Pepsi",
  "Phineas and Ferb",
  "Photoshop",
  "Picasso",
  "Pikachu",
  "Pink Panther",
  "Pinocchio",
  "Playstation",
  "Pluto",
  "Pokemon",
  "Popeye",
  "Popsicle",
  "Porky Pig",
  "Portugal",
  "Poseidon",
  "Pringles",
  "Pumba",
  "Reddit",
  "Rick",
  "Robbie Rotten",
  "Robin Hood",
  "Romania",
  "Rome",
  "Russia",
  "Samsung",
  "Santa",
  "Saturn",
  "Scooby Doo",
  "Scotland",
  "Segway",
  "Sherlock Holmes",
  "Shrek",
  "Singapore",
  "Skittles",
  "Skrillex",
  "Skype",
  "Slinky",
  "Solar System",
  "Sonic",
  "Spain",
  "Spartacus",
  "Spiderman",
  "SpongeBob",
  "Squidward",
  "Star Wars",
  "Statue of Liberty",
  "Steam",
  "Stegosaurus",
  "Steve Jobs",
  "Stone Age",
  "Sudoku",
  "Suez Canal",
  "Superman",
  "Susan Wojcicki",
  "Sydney Opera House",
  "T-rex",
  "Tails",
  "Tarzan",
  "Teletubby",
  "Terminator",
  "Tetris",
  "The Beatles",
  "Thor",
  "Titanic",
  "Tooth Fairy",
  "Tower Bridge",
  "Tower of Pisa",
  "Tweety",
  "Twitter",
  "UFO",
  "USB",
  "Uranus",
  "Usain Bolt",
  "Vatican",
  "Vault boy",
  "Velociraptor",
  "Venus",
  "Vin Diesel",
  "W-LAN",
  "Wall-e",
  "WhatsApp",
  "William Shakespeare",
  "William Wallace",
  "Winnie the Pooh",
  "Wolverine",
  "Wonder Woman",
  "Xbox",
  "Xerox",
  "Yin and Yang",
  "Yoda",
  "Yoshi",
  "Youtube",
  "Zelda",
  "Zeus",
  "Zorro",
  "Zuma",
  "abstract",
  "abyss",
  "accident",
  "accordion",
  "ace",
  "acid",
  "acne",
  "acorn",
  "action",
  "actor",
  "addiction",
  "addition",
  "adorable",
  "adult",
  "advertisement",
  "afro",
  "afterlife",
  "air conditioner",
  "airbag",
  "aircraft",
  "airplane",
  "airport",
  "alarm",
  "albatross",
  "alcohol",
  "alien",
  "allergy",
  "alley",
  "alligator",
  "almond",
  "alpaca",
  "ambulance",
  "anaconda",
  "anchor",
  "angel",
  "anglerfish",
  "angry",
  "animation",
  "anime",
  "ant",
  "anteater",
  "antelope",
  "antenna",
  "anthill",
  "antivirus",
  "anvil",
  "apartment",
  "apocalypse",
  "applause",
  "apple",
  "apple pie",
  "apple seed",
  "apricot",
  "aquarium",
  "arch",
  "archaeologist",
  "archer",
  "architect",
  "aristocrat",
  "arm",
  "armadillo",
  "armor",
  "armpit",
  "arrow",
  "ash",
  "assassin",
  "assault",
  "asteroid",
  "astronaut",
  "asymmetry",
  "athlete",
  "atom",
  "attic",
  "audience",
  "autograph",
  "avocado",
  "axe",
  "baboon",
  "baby",
  "back pain",
  "backbone",
  "backflip",
  "backpack",
  "bacon",
  "bad",
  "badger",
  "bag",
  "bagel",
  "bagpipes",
  "baguette",
  "bait",
  "bakery",
  "baklava",
  "balance",
  "balcony",
  "bald",
  "ball",
  "ballerina",
  "ballet",
  "balloon",
  "bamboo",
  "banana",
  "bandage",
  "bandana",
  "banjo",
  "bank",
  "banker",
  "bar",
  "barbarian",
  "barbecue",
  "barbed wire",
  "barber",
  "barcode",
  "bark",
  "barn",
  "barrel",
  "bartender",
  "base",
  "basement",
  "basket",
  "basketball",
  "bat",
  "bathroom",
  "bathtub",
  "battery",
  "battle",
  "battleship",
  "bayonet",
  "bazooka",
  "beach",
  "beak",
  "bean",
  "bean bag",
  "beanie",
  "beanstalk",
  "bear",
  "bear trap",
  "beatbox",
  "beaver",
  "bed",
  "bed bug",
  "bed sheet",
  "bedtime",
  "bee",
  "beef",
  "beer",
  "beet",
  "beetle",
  "bell",
  "bell pepper",
  "bellow",
  "belly",
  "belly button",
  "below",
  "belt",
  "bench",
  "betray",
  "bicycle",
  "bill",
  "billiards",
  "bingo",
  "binoculars",
  "biology",
  "birch",
  "bird",
  "bird bath",
  "birthday",
  "biscuit",
  "bite",
  "black",
  "black hole",
  "blackberry",
  "blacksmith",
  "blanket",
  "bleach",
  "blender",
  "blimp",
  "blind",
  "blindfold",
  "blizzard",
  "blood",
  "blowfish",
  "blue",
  "blueberry",
  "blush",
  "boar",
  "board",
  "boat",
  "bobsled",
  "bodyguard",
  "boil",
  "bomb",
  "booger",
  "book",
  "bookmark",
  "bookshelf",
  "boomerang",
  "boots",
  "border",
  "bottle",
  "bottle flip",
  "bounce",
  "bouncer",
  "bow",
  "bowl",
  "bowling",
  "box",
  "boy",
  "bracelet",
  "braces",
  "brain",
  "brainwash",
  "branch",
  "brand",
  "bread",
  "breakfast",
  "breath",
  "brick",
  "bricklayer",
  "bride",
  "bridge",
  "broadcast",
  "broccoli",
  "broken heart",
  "bronze",
  "broom",
  "broomstick",
  "brownie",
  "bruise",
  "brunette",
  "brush",
  "bubble",
  "bubble gum",
  "bucket",
  "building",
  "bulge",
  "bull",
  "bulldozer",
  "bullet",
  "bumper",
  "bungee jumping",
  "bunk bed",
  "bunny",
  "burglar",
  "burp",
  "burrito",
  "bus",
  "bus driver",
  "bus stop",
  "butcher",
  "butler",
  "butt cheeks",
  "butter",
  "butterfly",
  "button",
  "cab driver",
  "cabin",
  "cabinet",
  "cactus",
  "cage",
  "cake",
  "calendar",
  "camel",
  "camera",
  "campfire",
  "camping",
  "can",
  "can opener",
  "canary",
  "candle",
  "canister",
  "cannon",
  "canyon",
  "cap",
  "cape",
  "cappuccino",
  "captain",
  "car wash",
  "cardboard",
  "carnival",
  "carnivore",
  "carpenter",
  "carpet",
  "carrot",
  "cartoon",
  "cash",
  "casino",
  "cast",
  "cat",
  "catalog",
  "catapult",
  "caterpillar",
  "catfish",
  "cathedral",
  "cauldron",
  "cauliflower",
  "cave",
  "caveman",
  "caviar",
  "ceiling",
  "ceiling fan",
  "celebrate",
  "celebrity",
  "cell",
  "cell phone",
  "cello",
  "cement",
  "centaur",
  "centipede",
  "chain",
  "chainsaw",
  "chair",
  "chalk",
  "chameleon",
  "champagne",
  "champion",
  "chandelier",
  "charger",
  "cheek",
  "cheeks",
  "cheerleader",
  "cheese",
  "cheeseburger",
  "cheesecake",
  "cheetah",
  "chef",
  "chemical",
  "cherry",
  "cherry blossom",
  "chess",
  "chest",
  "chest hair",
  "chestnut",
  "chestplate",
  "chew",
  "chicken",
  "chihuahua",
  "child",
  "chime",
  "chimney",
  "chimpanzee",
  "chin",
  "chinchilla",
  "chocolate",
  "chopsticks",
  "church",
  "cicada",
  "cigarette",
  "cinema",
  "circle",
  "circus",
  "clap",
  "clarinet",
  "classroom",
  "claw",
  "clay",
  "clean",
  "clickbait",
  "cliff",
  "climb",
  "cloak",
  "clock",
  "cloth",
  "clothes hanger",
  "cloud",
  "clover",
  "clown",
  "clownfish",
  "coach",
  "coal",
  "coast",
  "coast guard",
  "coaster",
  "coat",
  "cobra",
  "cockroach",
  "cocktail",
  "coconut",
  "cocoon",
  "coffee",
  "coffee shop",
  "coffin",
  "coin",
  "cola",
  "cold",
  "collapse",
  "collar",
  "color-blind",
  "comb",
  "comedian",
  "comedy",
  "comet",
  "comfortable",
  "comic book",
  "commander",
  "commercial",
  "communism",
  "community",
  "compass",
  "complete",
  "computer",
  "concert",
  "condiment",
  "cone",
  "confused",
  "console",
  "continent",
  "controller",
  "conversation",
  "cookie",
  "cookie jar",
  "copper",
  "copy",
  "coral",
  "coral reef",
  "cord",
  "cork",
  "corkscrew",
  "corn",
  "corn dog",
  "corner",
  "cornfield",
  "corpse",
  "cotton",
  "cotton candy",
  "country",
  "cousin",
  "cow",
  "cowbell",
  "cowboy",
  "coyote",
  "crab",
  "crack",
  "crate",
  "crawl space",
  "crayon",
  "cream",
  "credit",
  "credit card",
  "cricket",
  "cringe",
  "crocodile",
  "croissant",
  "crossbow",
  "crow",
  "crowbar",
  "crucible",
  "cruise",
  "crust",
  "crystal",
  "cube",
  "cuckoo",
  "cucumber",
  "cup",
  "cupboard",
  "cupcake",
  "curry",
  "curtain",
  "cushion",
  "customer",
  "cut",
  "cute",
  "cyborg",
  "cylinder",
  "cymbal",
  "dagger",
  "daisy",
  "dalmatian",
  "dance",
  "dandelion",
  "dandruff",
  "darts",
  "dashboard",
  "daughter",
  "day",
  "dead",
  "deaf",
  "deep",
  "deer",
  "defense",
  "delivery",
  "demon",
  "demonstration",
  "dent",
  "dentist",
  "deodorant",
  "depressed",
  "derp",
  "desert",
  "desk",
  "desperate",
  "dessert",
  "detective",
  "detonate",
  "dew",
  "diagonal",
  "diagram",
  "diamond",
  "diaper",
  "dice",
  "dictionary",
  "die",
  "diet",
  "dig",
  "dinner",
  "dinosaur",
  "diploma",
  "dirty",
  "disaster",
  "disease",
  "dishrag",
  "dispenser",
  "display",
  "diss track",
  "distance",
  "diva",
  "divorce",
  "dizzy",
  "dock",
  "doctor",
  "dog",
  "doghouse",
  "doll",
  "dollar",
  "dollhouse",
  "dolphin",
  "dome",
  "dominoes",
  "donkey",
  "door",
  "doorknob",
  "dots",
  "double",
  "dough",
  "download",
  "dragon",
  "dragonfly",
  "drain",
  "drama",
  "drawer",
  "dream",
  "dress",
  "drink",
  "drip",
  "drive",
  "driver",
  "drool",
  "droplet",
  "drought",
  "drum",
  "drum kit",
  "duck",
  "duct tape",
  "duel",
  "dwarf",
  "dynamite",
  "eagle",
  "ear",
  "earbuds",
  "earthquake",
  "earwax",
  "east",
  "eat",
  "echo",
  "eclipse",
  "eel",
  "egg",
  "eggplant",
  "elbow",
  "elder",
  "election",
  "electric car",
  "electric guitar",
  "electrician",
  "electricity",
  "elephant",
  "elevator",
  "embers",
  "emerald",
  "emoji",
  "employer",
  "emu",
  "end",
  "engine",
  "engineer",
  "equator",
  "eraser",
  "error",
  "eskimo",
  "espresso",
  "evaporate",
  "evening",
  "evolution",
  "exam",
  "excavator",
  "exercise",
  "explosion",
  "eye",
  "eyebrow",
  "eyelash",
  "eyeshadow",
  "fabric",
  "fabulous",
  "facade",
  "face",
  "face paint",
  "factory",
  "failure",
  "fairy",
  "fake teeth",
  "fall",
  "family",
  "farm",
  "farmer",
  "fashion designer",
  "fast",
  "fast food",
  "fast forward",
  "father",
  "faucet",
  "feather",
  "fence",
  "fencing",
  "fern",
  "festival",
  "fidget spinner",
  "field",
  "figurine",
  "filmmaker",
  "filter",
  "finger",
  "fingernail",
  "fingertip",
  "fire alarm",
  "fire hydrant",
  "fire truck",
  "fireball",
  "firecracker",
  "firefighter",
  "firefly",
  "firehouse",
  "fireman",
  "fireplace",
  "fireproof",
  "fireside",
  "firework",
  "fish",
  "fish bowl",
  "fisherman",
  "fist fight",
  "fitness trainer",
  "fizz",
  "flag",
  "flagpole",
  "flamethrower",
  "flamingo",
  "flashlight",
  "flask",
  "flea",
  "flight attendant",
  "flock",
  "floodlight",
  "floppy disk",
  "florist",
  "flower",
  "flu",
  "fluid",
  "flush",
  "flute",
  "fly",
  "fly swatter",
  "flying pig",
  "fog",
  "foil",
  "folder",
  "food",
  "forehead",
  "forest",
  "forest fire",
  "fork",
  "fort",
  "fortress",
  "fortune",
  "fossil",
  "fountain",
  "fox",
  "frame",
  "freckles",
  "freezer",
  "fridge",
  "fries",
  "frog",
  "frostbite",
  "frosting",
  "frown",
  "fruit",
  "full",
  "full moon",
  "funeral",
  "funny",
  "fur",
  "furniture",
  "galaxy",
  "gang",
  "gangster",
  "garage",
  "garbage",
  "garden",
  "gardener",
  "garlic",
  "gas",
  "gas mask",
  "gasoline",
  "gasp",
  "gate",
  "gem",
  "gender",
  "generator",
  "genie",
  "gentle",
  "gentleman",
  "geography",
  "germ",
  "geyser",
  "ghost",
  "giant",
  "gift",
  "giraffe",
  "girl",
  "gladiator",
  "glass",
  "glasses",
  "glitter",
  "globe",
  "gloss",
  "glove",
  "glow",
  "glowstick",
  "glue",
  "glue stick",
  "gnome",
  "goal",
  "goat",
  "goatee",
  "goblin",
  "godfather",
  "gold",
  "gold chain",
  "golden apple",
  "golden egg",
  "goldfish",
  "golf",
  "golf cart",
  "good",
  "goose",
  "gorilla",
  "graduation",
  "graffiti",
  "grandmother",
  "grapefruit",
  "grapes",
  "graph",
  "grass",
  "grasshopper",
  "grave",
  "gravedigger",
  "gravel",
  "graveyard",
  "gravity",
  "greed",
  "grenade",
  "grid",
  "grill",
  "grin",
  "groom",
  "grumpy",
  "guillotine",
  "guinea pig",
  "guitar",
  "gumball",
  "gummy",
  "gummy bear",
  "gummy worm",
  "hacker",
  "hair",
  "hair roller",
  "hairbrush",
  "haircut",
  "hairspray",
  "hairy",
  "half",
  "halo",
  "ham",
  "hamburger",
  "hammer",
  "hammock",
  "hamster",
  "hand",
  "handicap",
  "handle",
  "handshake",
  "hanger",
  "happy",
  "harbor",
  "hard",
  "hard hat",
  "harmonica",
  "harp",
  "harpoon",
  "hashtag",
  "hat",
  "hazard",
  "hazelnut",
  "head",
  "headache",
  "headband",
  "headboard",
  "heading",
  "headphones",
  "health",
  "heart",
  "heat",
  "hedgehog",
  "heel",
  "heist",
  "helicopter",
  "hell",
  "helmet",
  "hen",
  "hermit",
  "hero",
  "hexagon",
  "hibernate",
  "hieroglyph",
  "high five",
  "high heels",
  "high score",
  "highway",
  "hilarious",
  "hill",
  "hip hop",
  "hippie",
  "hippo",
  "hitchhiker",
  "hive",
  "hobbit",
  "hockey",
  "holiday",
  "homeless",
  "honey",
  "honeycomb",
  "hoof",
  "hook",
  "hop",
  "hopscotch",
  "horizon",
  "horn",
  "horse",
  "horsewhip",
  "hose",
  "hospital",
  "hot",
  "hot chocolate",
  "hot dog",
  "hot sauce",
  "hotel",
  "hourglass",
  "house",
  "hovercraft",
  "hug",
  "hummingbird",
  "hunger",
  "hunter",
  "hurdle",
  "hurt",
  "husband",
  "hut",
  "hyena",
  "hypnotize",
  "iPad",
  "iPhone",
  "ice",
  "ice cream",
  "ice cream truck",
  "iceberg",
  "icicle",
  "idea",
  "imagination",
  "impact",
  "incognito",
  "industry",
  "infinite",
  "injection",
  "insect",
  "inside",
  "insomnia",
  "internet",
  "intersection",
  "interview",
  "invasion",
  "invention",
  "invisible",
  "iron",
  "island",
  "ivy",
  "jacket",
  "jackhammer",
  "jaguar",
  "jail",
  "jalapeno",
  "janitor",
  "jaw",
  "jazz",
  "jeans",
  "jeep",
  "jello",
  "jelly",
  "jellyfish",
  "jester",
  "jet ski",
  "joker",
  "journalist",
  "journey",
  "judge",
  "juggle",
  "juice",
  "jump rope",
  "jungle",
  "junk food",
  "kangaroo",
  "karaoke",
  "karate",
  "katana",
  "kazoo",
  "kebab",
  "keg",
  "kendama",
  "ketchup",
  "kettle",
  "key",
  "keyboard",
  "kidney",
  "kindergarten",
  "king",
  "kiss",
  "kitchen",
  "kite",
  "kitten",
  "kiwi",
  "knee",
  "kneel",
  "knife",
  "knight",
  "knot",
  "knuckle",
  "koala",
  "kraken",
  "label",
  "laboratory",
  "ladder",
  "lady",
  "ladybug",
  "lake",
  "lamb",
  "lamp",
  "landlord",
  "landscape",
  "lane",
  "language",
  "lantern",
  "lap",
  "laptop",
  "laser",
  "lasso",
  "laundry",
  "lava",
  "lava lamp",
  "lawn mower",
  "lawyer",
  "leader",
  "leaf",
  "leak",
  "leash",
  "leather",
  "leave",
  "leech",
  "legs",
  "lemon",
  "lemonade",
  "lemur",
  "lens",
  "leprechaun",
  "lettuce",
  "levitate",
  "librarian",
  "library",
  "licorice",
  "lid",
  "lightbulb",
  "lighter",
  "lighthouse",
  "lightning",
  "lightsaber",
  "lily",
  "lilypad",
  "limbo",
  "lime",
  "limousine",
  "line",
  "link",
  "lion",
  "lips",
  "lipstick",
  "litter box",
  "lizard",
  "llama",
  "loading",
  "loaf",
  "lobster",
  "lock",
  "log",
  "logo",
  "lollipop",
  "loot",
  "loser",
  "lotion",
  "lottery",
  "lounge",
  "love",
  "low",
  "luck",
  "luggage",
  "lumberjack",
  "lung",
  "lynx",
  "lyrics",
  "macaroni",
  "machine",
  "macho",
  "mafia",
  "magazine",
  "magic",
  "magic trick",
  "magic wand",
  "magician",
  "magma",
  "magnet",
  "magnifier",
  "maid",
  "mailbox",
  "mailman",
  "makeup",
  "mall",
  "mammoth",
  "manatee",
  "manhole",
  "manicure",
  "mannequin",
  "mansion",
  "mantis",
  "map",
  "maracas",
  "marathon",
  "marble",
  "margarine",
  "marigold",
  "market",
  "marmalade",
  "marmot",
  "marshmallow",
  "mascot",
  "mask",
  "massage",
  "match",
  "matchbox",
  "mattress",
  "mayonnaise",
  "mayor",
  "maze",
  "meal",
  "meat",
  "meatball",
  "meatloaf",
  "mechanic",
  "meerkat",
  "megaphone",
  "melon",
  "melt",
  "meme",
  "mermaid",
  "message",
  "messy",
  "metal",
  "meteorite",
  "microphone",
  "microscope",
  "microwave",
  "midnight",
  "military",
  "milk",
  "milkman",
  "milkshake",
  "mime",
  "miner",
  "minigolf",
  "minivan",
  "mint",
  "minute",
  "mirror",
  "missile",
  "model",
  "mohawk",
  "mold",
  "mole",
  "money",
  "monk",
  "monkey",
  "monster",
  "moon",
  "moose",
  "mop",
  "morning",
  "mosquito",
  "moss",
  "moth",
  "mothball",
  "mother",
  "motherboard",
  "motorbike",
  "motorcycle",
  "mountain",
  "mouse",
  "mousetrap",
  "mouth",
  "movie",
  "mud",
  "muffin",
  "mug",
  "murderer",
  "muscle",
  "museum",
  "mushroom",
  "musket",
  "mustache",
  "mustard",
  "nachos",
  "nail",
  "nail file",
  "nail polish",
  "napkin",
  "narwhal",
  "nature",
  "navy",
  "neck",
  "needle",
  "neighbor",
  "neighborhood",
  "nerd",
  "nest",
  "network",
  "newspaper",
  "nickel",
  "night",
  "nightclub",
  "nightmare",
  "ninja",
  "noob",
  "noodle",
  "north",
  "nose",
  "nose hair",
  "nose ring",
  "nosebleed",
  "nostrils",
  "notebook",
  "notepad",
  "nothing",
  "notification",
  "novel",
  "nugget",
  "nuke",
  "nun",
  "nurse",
  "nut",
  "nutcracker",
  "nutmeg",
  "nutshell",
  "oar",
  "observatory",
  "ocean",
  "octagon",
  "octopus",
  "office",
  "oil",
  "old",
  "omelet",
  "onion",
  "open",
  "opera",
  "orange",
  "orangutan",
  "orbit",
  "orca",
  "orchestra",
  "orchid",
  "organ",
  "origami",
  "ostrich",
  "otter",
  "outside",
  "oval",
  "overweight",
  "owl",
  "oxygen",
  "oyster",
  "paddle",
  "page",
  "pain",
  "paint",
  "paintball",
  "pajamas",
  "palace",
  "palette",
  "palm",
  "palm tree",
  "pan",
  "pancake",
  "panda",
  "panpipes",
  "panther",
  "pants",
  "papaya",
  "paper",
  "paper bag",
  "parachute",
  "parade",
  "parakeet",
  "parents",
  "park",
  "parking",
  "parrot",
  "party",
  "password",
  "pasta",
  "pastry",
  "path",
  "patient",
  "patio",
  "patriot",
  "pause",
  "pavement",
  "paw",
  "peace",
  "peach",
  "peacock",
  "peanut",
  "pear",
  "peas",
  "peasant",
  "pedal",
  "pelican",
  "pencil",
  "pencil case",
  "pencil sharpener",
  "pendulum",
  "penguin",
  "peninsula",
  "penny",
  "pensioner",
  "pepper",
  "pepperoni",
  "perfume",
  "periscope",
  "person",
  "pet food",
  "pet shop",
  "petal",
  "pharmacist",
  "photo frame",
  "photograph",
  "photographer",
  "piano",
  "pickaxe",
  "pickle",
  "picnic",
  "pie",
  "pig",
  "pigeon",
  "piggy bank",
  "pigsty",
  "pike",
  "pill",
  "pillar",
  "pillow",
  "pillow fight",
  "pilot",
  "pimple",
  "pin",
  "pinball",
  "pine",
  "pine cone",
  "pineapple",
  "pink",
  "pinky",
  "pinwheel",
  "pipe",
  "pirate",
  "pirate ship",
  "pistachio",
  "pistol",
  "pitchfork",
  "pizza",
  "plague",
  "planet",
  "plank",
  "plate",
  "platypus",
  "player",
  "playground",
  "plow",
  "plug",
  "plumber",
  "plunger",
  "pocket",
  "pogo stick",
  "point",
  "poison",
  "poisonous",
  "poke",
  "polar bear",
  "policeman",
  "pollution",
  "polo",
  "pond",
  "pony",
  "ponytail",
  "poodle",
  "poop",
  "poor",
  "popcorn",
  "pope",
  "poppy",
  "popular",
  "porch",
  "porcupine",
  "portal",
  "portrait",
  "positive",
  "postcard",
  "poster",
  "pot",
  "pot of gold",
  "potato",
  "potion",
  "pound",
  "powder",
  "prawn",
  "pray",
  "preach",
  "pregnant",
  "present",
  "president",
  "pretzel",
  "price tag",
  "priest",
  "prince",
  "princess",
  "printer",
  "prism",
  "prison",
  "pro",
  "procrastination",
  "professor",
  "programmer",
  "promotion",
  "protest",
  "provoke",
  "prune",
  "pub",
  "pudding",
  "puddle",
  "puffin",
  "puma",
  "pumpkin",
  "punishment",
  "punk",
  "puppet",
  "purity",
  "purse",
  "puzzle",
  "pyramid",
  "quarter",
  "queen",
  "queue",
  "quicksand",
  "quill",
  "quilt",
  "quokka",
  "raccoon",
  "race",
  "racecar",
  "radar",
  "radiation",
  "radio",
  "radish",
  "raft",
  "rail",
  "rain",
  "rainbow",
  "raincoat",
  "raindrop",
  "rainforest",
  "raisin",
  "rake",
  "ram",
  "ramp",
  "rapper",
  "raspberry",
  "rat",
  "ravioli",
  "razor",
  "razorblade",
  "read",
  "reality",
  "reception",
  "receptionist",
  "record",
  "rectangle",
  "recycling",
  "red",
  "red carpet",
  "reeds",
  "referee",
  "reflection",
  "reindeer",
  "relationship",
  "religion",
  "remote",
  "repeat",
  "reptile",
  "rest",
  "restaurant",
  "retail",
  "revolver",
  "rewind",
  "rhinoceros",
  "rib",
  "ribbon",
  "rice",
  "ring",
  "ringtone",
  "risk",
  "river",
  "roadblock",
  "robber",
  "robin",
  "robot",
  "rock",
  "rocket",
  "rockstar",
  "roll",
  "roof",
  "room",
  "rooster",
  "root",
  "rose",
  "royal",
  "rubber",
  "ruby",
  "rug",
  "ruler",
  "run",
  "rune",
  "sad",
  "saddle",
  "safari",
  "safe",
  "sailboat",
  "salad",
  "sale",
  "saliva",
  "salmon",
  "salt",
  "saltwater",
  "sand",
  "sand castle",
  "sandbox",
  "sandstorm",
  "sandwich",
  "satellite",
  "sauce",
  "sauna",
  "sausage",
  "saxophone",
  "scar",
  "scarecrow",
  "scarf",
  "scary",
  "scent",
  "school",
  "science",
  "scientist",
  "scissors",
  "scoop",
  "score",
  "scream",
  "screen",
  "screw",
  "scribble",
  "scuba",
  "sculpture",
  "scythe",
  "sea",
  "sea lion",
  "seafood",
  "seagull",
  "seahorse",
  "seal",
  "search",
  "seashell",
  "seasick",
  "season",
  "seat belt",
  "seaweed",
  "second",
  "security",
  "seed",
  "seesaw",
  "semicircle",
  "sensei",
  "server",
  "sew",
  "sewing machine",
  "shadow",
  "shake",
  "shallow",
  "shampoo",
  "shape",
  "shark",
  "shaving cream",
  "sheep",
  "shelf",
  "shell",
  "shipwreck",
  "shirt",
  "shock",
  "shoe",
  "shoebox",
  "shoelace",
  "shop",
  "shopping",
  "shopping cart",
  "short",
  "shotgun",
  "shoulder",
  "shout",
  "shovel",
  "shower",
  "shrew",
  "shrub",
  "shy",
  "sick",
  "signature",
  "silence",
  "silo",
  "silver",
  "silverware",
  "sing",
  "sink",
  "sit",
  "six pack",
  "skateboard",
  "skateboarder",
  "skates",
  "skeleton",
  "ski",
  "ski jump",
  "skin",
  "skinny",
  "skribbl.io",
  "skull",
  "skunk",
  "sky",
  "skydiving",
  "skyline",
  "skyscraper",
  "slam",
  "sledge",
  "sledgehammer",
  "sleep",
  "sleeve",
  "slide",
  "slime",
  "slingshot",
  "slippery",
  "slope",
  "sloth",
  "slow",
  "slump",
  "smell",
  "smile",
  "smoke",
  "snail",
  "snake",
  "sneeze",
  "sniper",
  "snow",
  "snowball",
  "snowball fight",
  "snowboard",
  "snowflake",
  "snowman",
  "soap",
  "soccer",
  "social media",
  "socket",
  "socks",
  "soda",
  "soil",
  "soldier",
  "sombrero",
  "son",
  "sound",
  "soup",
  "south",
  "space",
  "space suit",
  "spaceship",
  "spade",
  "spaghetti",
  "spark",
  "sparkles",
  "spatula",
  "speaker",
  "spear",
  "spelunker",
  "sphinx",
  "spider",
  "spin",
  "spinach",
  "spine",
  "spiral",
  "spit",
  "spoiler",
  "sponge",
  "spool",
  "spoon",
  "spore",
  "sports",
  "spray paint",
  "spring",
  "sprinkler",
  "spy",
  "square",
  "squid",
  "squirrel",
  "stab",
  "stadium",
  "stage",
  "stamp",
  "stand",
  "stapler",
  "star",
  "starfish",
  "starfruit",
  "statue",
  "steam",
  "step",
  "stereo",
  "sting",
  "stingray",
  "stomach",
  "stone",
  "stoned",
  "stop sign",
  "stork",
  "storm",
  "stove",
  "straw",
  "strawberry",
  "streamer",
  "street",
  "stress",
  "strong",
  "student",
  "studio",
  "study",
  "stylus",
  "submarine",
  "subway",
  "sugar",
  "suitcase",
  "summer",
  "sun",
  "sunburn",
  "sunflower",
  "sunglasses",
  "sunrise",
  "sunshade",
  "supermarket",
  "superpower",
  "surface",
  "surfboard",
  "surgeon",
  "survivor",
  "sushi",
  "swag",
  "swamp",
  "swan",
  "swarm",
  "sweat",
  "sweater",
  "swimming pool",
  "swimsuit",
  "swing",
  "switch",
  "sword",
  "swordfish",
  "symphony",
  "table",
  "table tennis",
  "tablecloth",
  "tablet",
  "tabletop",
  "taco",
  "tadpole",
  "tail",
  "tailor",
  "take off",
  "talent show",
  "tampon",
  "tangerine",
  "tank",
  "tape",
  "tarantula",
  "target",
  "taser",
  "tattoo",
  "taxi",
  "taxi driver",
  "tea",
  "teacher",
  "teapot",
  "tear",
  "teaspoon",
  "teddy bear",
  "telephone",
  "telescope",
  "television",
  "temperature",
  "tennis",
  "tennis racket",
  "tent",
  "tentacle",
  "text",
  "thermometer",
  "thief",
  "thin",
  "think",
  "thirst",
  "throat",
  "throne",
  "thug",
  "thumb",
  "thunder",
  "thunderstorm",
  "ticket",
  "tickle",
  "tie",
  "tiger",
  "time machine",
  "timpani",
  "tiny",
  "tip",
  "tiramisu",
  "tire",
  "tired",
  "tissue",
  "tissue box",
  "toad",
  "toast",
  "toaster",
  "toe",
  "toenail",
  "toilet",
  "tomato",
  "tomb",
  "tombstone",
  "tongue",
  "toolbox",
  "tooth",
  "toothbrush",
  "toothpaste",
  "toothpick",
  "top hat",
  "torch",
  "tornado",
  "torpedo",
  "tortoise",
  "totem",
  "toucan",
  "touch",
  "tourist",
  "tow truck",
  "towel",
  "tower",
  "toy",
  "tractor",
  "traffic",
  "traffic light",
  "trailer",
  "train",
  "translate",
  "trap",
  "trapdoor",
  "trash can",
  "traveler",
  "treadmill",
  "treasure",
  "tree",
  "treehouse",
  "trend",
  "triangle",
  "trick shot",
  "tricycle",
  "trigger",
  "triplets",
  "tripod",
  "trombone",
  "trophy",
  "tropical",
  "truck",
  "truck driver",
  "trumpet",
  "tuba",
  "tug",
  "tumor",
  "tuna",
  "tunnel",
  "turd",
  "turkey",
  "turnip",
  "turtle",
  "tuxedo",
  "twig",
  "type",
  "udder",
  "ukulele",
  "umbrella",
  "uncle",
  "underground",
  "underweight",
  "undo",
  "unibrow",
  "unicorn",
  "unicycle",
  "uniform",
  "universe",
  "upgrade",
  "vacation",
  "vaccine",
  "vacuum",
  "valley",
  "vampire",
  "vanilla",
  "vanish",
  "vault",
  "vegetable",
  "vegetarian",
  "vein",
  "vent",
  "vertical",
  "veterinarian",
  "victim",
  "victory",
  "video",
  "video game",
  "village",
  "villain",
  "vine",
  "vinegar",
  "viola",
  "violence",
  "violin",
  "virtual reality",
  "virus",
  "vise",
  "vision",
  "vitamin",
  "vlogger",
  "vodka",
  "volcano",
  "volleyball",
  "volume",
  "vomit",
  "voodoo",
  "vortex",
  "vote",
  "vulture",
  "vuvuzela",
  "waffle",
  "waist",
  "waiter",
  "wake up",
  "walk",
  "wall",
  "wallpaper",
  "walnut",
  "walrus",
  "warehouse",
  "warm",
  "wart",
  "wasp",
  "watch",
  "water",
  "water cycle",
  "water gun",
  "waterfall",
  "wave",
  "wax",
  "weak",
  "wealth",
  "weapon",
  "weasel",
  "weather",
  "web",
  "website",
  "wedding",
  "welder",
  "well",
  "werewolf",
  "west",
  "western",
  "whale",
  "wheel",
  "wheelbarrow",
  "whisk",
  "whisper",
  "whistle",
  "white",
  "wife",
  "wig",
  "wiggle",
  "willow",
  "wind",
  "windmill",
  "window",
  "windshield",
  "wine",
  "wine glass",
  "wing",
  "wingnut",
  "winner",
  "winter",
  "wire",
  "wireless",
  "witch",
  "witness",
  "wizard",
  "wolf",
  "wonderland",
  "woodpecker",
  "wool",
  "work",
  "workplace",
  "world",
  "worm",
  "wound",
  "wrapping",
  "wreath",
  "wrench",
  "wrestler",
  "wrestling",
  "wrinkle",
  "wrist",
  "writer",
  "x-ray",
  "xylophone",
  "yacht",
  "yardstick",
  "yawn",
  "yearbook",
  "yellow",
  "yeti",
  "yo-yo",
  "yogurt",
  "yolk",
  "young",
  "youtuber",
  "zebra",
  "zeppelin",
  "zigzag",
  "zipline",
  "zipper",
  "zombie",
  "zoo",
  "zoom",
  "air fryer",
  "drone",
  "joystick",
  "moonlight",
  "scooter",
  "aardvark",
  "abacus",
  "abandoned",
  "above",
  "abs",
  "actress",
  "AFK",
  "afternoon",
  "age",
  "agreement",
  "agriculture",
  "air",
  "air horn",
  "AirPods",
  "airship",
  "Alaska",
  "alchemist",
  "algae",
  "Algeria",
  "alone",
  "alphabet",
  "aluminum",
  "Amazon",
  "amber",
  "ammo",
  "Among Us",
  "amp",
  "anatomy",
  "anchovy",
  "ancient",
  "ankle",
  "antlers",
  "app",
  "apron",
  "Aquaman",
  "Arctic",
  "armchair",
  "army",
  "art",
  "artery",
  "Arthritis",
  "artichoke",
  "artist",
  "ashtray",
  "asterisk",
  "asteroid belt",
  "Athena",
  "Athens",
  "Atlantic",
  "atmosphere",
  "ATV",
  "aunt",
  "Austria",
  "author",
  "autumn",
  "avalanche",
  "average",
  "award",
  "bachelor",
  "back",
  "back seat",
  "background",
  "badminton",
  "Bahamas",
  "baking powder",
  "baking sheet",
  "baking soda",
  "ballroom",
  "band",
  "bankrupt",
  "banner",
  "Barcelona",
  "barrier",
  "baseball",
  "baseball bat",
  "basil",
  "bass",
  "bath",
  "bathrobe",
  "bay",
  "beans",
  "beard",
  "bedroom",
  "beggar",
  "Beijing",
  "bench press",
  "bend",
  "beret",
  "Berlin",
  "Berlin Wall",
  "biceps",
  "bidet",
  "Bigfoot",
  "biker",
  "bikini",
  "birdcage",
  "birdhouse",
  "bison",
  "black and white",
  "black belt",
  "black pepper",
  "blaze",
  "bling",
  "block",
  "blossom",
  "blouse",
  "blow",
  "blow up",
  "blowtorch",
  "BLT",
  "blueprint",
  "board game",
  "Bob Ross",
  "body",
  "boiled egg",
  "bone",
  "bongo",
  "bonnet",
  "bonsai",
  "booklet",
  "bored",
  "boss",
  "bot",
  "bottom",
  "boulder",
  "bouquet",
  "bow tie",
  "bowling alley",
  "Bowser",
  "boxcar",
  "boxer",
  "boxing",
  "boyfriend",
  "bra",
  "Brachiosaurus",
  "Brad Pitt",
  "braid",
  "braille",
  "brain freeze",
  "brainstorm",
  "brake",
  "brawl",
  "break",
  "breakdance",
  "brick wall",
  "Britain",
  "Broadway",
  "broken",
  "brown",
  "bubble wrap",
  "Buddha",
  "buff",
  "buffalo",
  "buffer",
  "buffet",
  "bug",
  "bug spray",
  "build",
  "bulldog",
  "bulletproof",
  "bullseye",
  "bully",
  "bump",
  "bun",
  "bunker",
  "buoy",
  "Burger King",
  "burn",
  "bus terminal",
  "bush",
  "business card",
  "buttermilk",
  "cabbage",
  "cable",
  "cable car",
  "cafe",
  "calamari",
  "calculator",
  "calf",
  "California",
  "call",
  "cameraman",
  "camp",
  "canal",
  "cancer",
  "candy",
  "candy cane",
  "candy store",
  "cannonball",
  "canoe",
  "Capitalism",
  "capsule",
  "capture",
  "car",
  "car dealership",
  "caramel",
  "carbon",
  "card",
  "cardinal",
  "cargo",
  "cargo ship",
  "carp",
  "carrot cake",
  "carry",
  "cart",
  "case",
  "cashew",
  "cashier",
  "casserole",
  "cassette",
  "castanets",
  "castle",
  "casual",
  "Catan",
  "cavern",
  "celery",
  "cent",
  "center",
  "cereal",
  "chalkboard",
  "chaos",
  "chapstick",
  "Charlie Brown",
  "check",
  "checkers",
  "cheers",
  "cheese stick",
  "Cheetos",
  "chemistry",
  "Chevrolet",
  "chewing gum",
  "Chile",
  "chili",
  "chip",
  "chipmunk",
  "chips",
  "chives",
  "chlorine",
  "chorus",
  "Christmas Island",
  "Christmas tree",
  "chug",
  "cigar",
  "Cinderella",
  "cinnamon",
  "cinnamon roll",
  "circuit",
  "city",
  "Civil War",
  "clam",
  "clamp",
  "clerk",
  "click",
  "climber",
  "climbing wall",
  "clinic",
  "clip",
  "clipboard",
  "Clogs",
  "close",
  "closed",
  "closet",
  "clothes",
  "clothes iron",
  "cloudy",
  "club",
  "cobweb",
  "Coca Cola",
  "cocoa",
  "cod",
  "code",
  "coder",
  "coffee maker",
  "colander",
  "collarbone",
  "college",
  "cologne",
  "Colombia",
  "combine harvester",
  "company",
  "composer",
  "concealer",
  "concrete",
  "conductor",
  "conflict",
  "Connect Four",
  "conspiracy",
  "constellation",
  "construction",
  "contrabass",
  "contrast",
  "control tower",
  "converge",
  "conveyor belt",
  "cook",
  "cookie dough",
  "cookout",
  "copycat",
  "Corgi",
  "corn on the cob",
  "Coronavirus",
  "corrida",
  "couch",
  "countdown",
  "countryside",
  "couple",
  "court",
  "cover",
  "CPU",
  "crab cake",
  "cracker",
  "cradle",
  "cranberry",
  "crane",
  "crawl",
  "crayfish",
  "crazy",
  "creek",
  "creep",
  "crescent",
  "crime",
  "criminal",
  "cross",
  "crosswalk",
  "crowd",
  "crown",
  "cruise ship",
  "crumb",
  "crunch",
  "cry",
  "crystal ball",
  "cure",
  "currency",
  "cuttlefish",
  "cyclist",
  "cyclops",
  "dab",
  "dairy",
  "dam",
  "damage",
  "Danish",
  "dark",
  "Darth Vader",
  "dawn",
  "daydream",
  "Dead Sea",
  "death",
  "Death Star",
  "debit card",
  "defender",
  "defibrillator",
  "degree",
  "delicious",
  "Democrat",
  "demolition derby",
  "den",
  "Denmark",
  "detergent",
  "devil",
  "diary",
  "didgeridoo",
  "dill",
  "dining room",
  "dip",
  "direction",
  "dirt",
  "disabled",
  "disagree",
  "disgusting",
  "dish",
  "dish soap",
  "dishes",
  "dishwasher",
  "dive",
  "diverge",
  "division",
  "Doge",
  "dogfish",
  "Donkey Kong",
  "donut",
  "doormat",
  "Dory",
  "dove",
  "down",
  "downstairs",
  "Dr. Seuss",
  "Dr. Watson",
  "drag",
  "dream catcher",
  "dressing",
  "drift",
  "drill",
  "drinking fountain",
  "drivers license",
  "driveway",
  "drown",
  "drug",
  "drum roll",
  "drunk",
  "dry",
  "dryer",
  "dumb",
  "dumbbell",
  "dump",
  "dump truck",
  "dumpling",
  "dune",
  "dunes",
  "dungeon",
  "dusk",
  "dye",
  "earmuffs",
  "Easter Island",
  "echidna",
  "eclair",
  "Ed Sheeran",
  "edge",
  "egg hunt",
  "elf",
  "elk",
  "ellipse",
  "elliptical",
  "email",
  "emergency",
  "empty",
  "English Channel",
  "envelope",
  "environment",
  "equation",
  "escalator",
  "excited",
  "executioner",
  "exhaust",
  "exhausted",
  "exit",
  "exit ramp",
  "experiment",
  "explode",
  "explorer",
  "extinct",
  "extinction",
  "extravert",
  "eyelid",
  "eyeliner",
  "eyepatch",
  "fairy tale",
  "falafel",
  "falcon",
  "fallout",
  "fan",
  "fanny pack",
  "fart",
  "fat",
  "fax machine",
  "fedora",
  "ferret",
  "Ferris wheel",
  "ferry",
  "fertilizer",
  "fettuccine",
  "fever",
  "Fifa",
  "fig",
  "file",
  "fingerprint",
  "Finland",
  "fire",
  "fire extinguisher",
  "fire hose",
  "Firefox",
  "fish and chips",
  "fishing net",
  "fishing rod",
  "fist",
  "fist bump",
  "flat",
  "flex",
  "flicker",
  "flight",
  "float",
  "flood",
  "floor",
  "flop",
  "floss",
  "flour",
  "flow",
  "flying car",
  "foam",
  "fold",
  "follow",
  "foot",
  "football",
  "footrest",
  "force",
  "force field",
  "forearm",
  "formal",
  "Fortnite",
  "foundation",
  "fresh",
  "fried chicken",
  "fried egg",
  "friend",
  "friendship bracelet",
  "Frisbee",
  "Frogger",
  "front",
  "fry",
  "fudge",
  "fuel",
  "fungus",
  "furious",
  "furnace",
  "furry",
  "future",
  "gag",
  "gallery",
  "game",
  "Game Boy",
  "gamer",
  "gamer girl",
  "gangrene",
  "gap",
  "garbage truck",
  "garlic powder",
  "gas station",
  "gecko",
  "genius",
  "George Washington",
  "ghoul",
  "ginger",
  "gingerbread",
  "girlfriend",
  "give",
  "give up",
  "glacier",
  "glider",
  "global warming",
  "gloves",
  "goalie",
  "goddess",
  "Godzilla",
  "gold ingot",
  "Goldilocks",
  "golem",
  "golf club",
  "gondola",
  "gong",
  "gopher",
  "gourd",
  "grain",
  "gramophone",
  "Grand Canyon",
  "grandfather",
  "graphics card",
  "graphite",
  "gravy",
  "grease",
  "Great Barrier Reef",
  "Great Lakes",
  "green",
  "green beans",
  "greenhouse",
  "Greenland",
  "grey",
  "griffin",
  "grilled cheese",
  "Grim Reaper",
  "grits",
  "groan",
  "groundhog",
  "group",
  "grow up",
  "growl",
  "GTA",
  "guacamole",
  "guard",
  "guiro",
  "Guitar Hero",
  "Gulf of Mexico",
  "gum",
  "gun",
  "gunpowder",
  "gutter",
  "gym",
  "gymnastics",
  "habanero",
  "Hades",
  "hail",
  "hair dryer",
  "hair gel",
  "hairband",
  "hairdresser",
  "hallway",
  "handcuffs",
  "handkerchief",
  "handstand",
  "hangman",
  "harvester",
  "hash browns",
  "hatch",
  "haunted",
  "haunted house",
  "hay bale",
  "headbutt",
  "healthy",
  "hearse",
  "hearth",
  "heaven",
  "hedge",
  "height",
  "helium",
  "herbivore",
  "herd",
  "Hermes",
  "high",
  "high school",
  "highlighter",
  "hijab",
  "hiking",
  "hipster",
  "hit",
  "hockey stick",
  "hoe",
  "hold",
  "hole",
  "hole in one",
  "Honda",
  "honey mustard",
  "honeymoon",
  "hood",
  "hoodie",
  "horseshoe",
  "hot air balloon",
  "hour",
  "howl",
  "Hungary",
  "Hydra",
  "Ice Age",
  "ice cream shop",
  "ice fishing",
  "idiot",
  "ignite",
  "iguana",
  "Illuminati",
  "imp",
  "impale",
  "impostor",
  "Indonesia",
  "injury",
  "ink",
  "insane",
  "Instagram",
  "insulation",
  "intern",
  "introvert",
  "invincible",
  "Iran",
  "iron ingot",
  "Isaac Newton",
  "itch",
  "jam",
  "jar",
  "Jaws",
  "jealous",
  "Jedi",
  "Jeff Bezos",
  "Jerry Mouse",
  "jersey",
  "jet pack",
  "job",
  "Joe Biden",
  "joy",
  "jug",
  "juicer",
  "jump",
  "Jupiter",
  "Justin Bieber",
  "kayak",
  "keypad",
  "kick",
  "kill",
  "kilt",
  "kingdom",
  "Knuckles",
  "kombucha",
  "Kool-Aid",
  "koto",
  "lacrosse",
  "ladle",
  "LAN",
  "landfill",
  "landslide",
  "laser pointer",
  "laugh",
  "lavender",
  "lead",
  "leaf blower",
  "LeBron James",
  "leek",
  "left",
  "leggings",
  "leopard",
  "level",
  "liar",
  "license",
  "life buoy",
  "light",
  "Lightning McQueen",
  "lilac",
  "lip balm",
  "Lisa Simpson",
  "list",
  "liver",
  "lobby",
  "lobster roll",
  "Loch Ness",
  "locker",
  "log flume",
  "Loki",
  "lonely",
  "long coat",
  "look",
  "loop",
  "lorry",
  "loss",
  "loud",
  "Louvre",
  "luggage cart",
  "lunch",
  "lute",
  "luxury",
  "Mac",
  "mace",
  "machete",
  "machine gun",
  "Machu Picchu",
  "Machu-Picchu",
  "mail",
  "majority",
  "mallet",
  "man",
  "mane",
  "mango",
  "manure",
  "many",
  "maple",
  "march",
  "Marge Simpson",
  "marimba",
  "Marines",
  "marker",
  "Markiplier",
  "mascara",
  "mashed potatoes",
  "math",
  "mathematics",
  "meadow",
  "mean",
  "measure",
  "mechanical pencil",
  "medal",
  "median",
  "medication",
  "memory",
  "menu",
  "merch",
  "merengues",
  "meteor",
  "metro",
  "Mexico City",
  "Michael Jordan",
  "middle",
  "millipede",
  "Minesweeper",
  "minority",
  "mirage",
  "mist",
  "moat",
  "Moby Dick",
  "modern",
  "monkey bars",
  "monocle",
  "moo",
  "moon bounce",
  "Morocco",
  "Moscow",
  "Mount Fuji",
  "mouse pad",
  "mousepad",
  "movement",
  "mow",
  "mozzarella",
  "MrBeast",
  "muddy",
  "mugshot",
  "mule",
  "multiplication",
  "music",
  "music box",
  "music notes",
  "Napoleon",
  "Narnia",
  "NBA",
  "necklace",
  "negative",
  "neon",
  "Nepal",
  "nephew",
  "Netflix",
  "Nether",
  "new",
  "New Year",
  "New York",
  "news",
  "NFL",
  "Nicolas Cage",
  "niece",
  "nightlight",
  "Nintendo",
  "nitrogen",
  "nod",
  "noise",
  "noon",
  "North America",
  "North Pole",
  "North Sea",
  "note",
  "Notre-Dame",
  "nuclear",
  "nunchucks",
  "oak",
  "oasis",
  "oatmeal",
  "oboe",
  "obsidian",
  "ocarina",
  "ocelot",
  "offline",
  "ogre",
  "Oktoberfest",
  "olive",
  "olive oil",
  "Olympics",
  "onion powder",
  "online",
  "orchard",
  "ornament",
  "outer space",
  "outlaw",
  "outlet",
  "oven",
  "oven mitt",
  "overalls",
  "overpass",
  "Overwatch",
  "ozone",
  "Pacific",
  "pacifier",
  "package",
  "pad",
  "paint roller",
  "painting",
  "pair",
  "Pakistan",
  "pandemic",
  "panini",
  "pantry",
  "paparazzi",
  "paper clip",
  "paper plane",
  "paper towels",
  "paperclip",
  "paragliding",
  "parallel",
  "parasol",
  "parking meter",
  "Parmesan",
  "parsley",
  "passenger",
  "passport",
  "pasture",
  "peanut butter",
  "pearl",
  "pebble",
  "pecan",
  "pedicure",
  "Pegasus",
  "pen",
  "penne",
  "pentagon",
  "period",
  "Peru",
  "PewDiePie",
  "pharaoh",
  "pharmacy",
  "Philippines",
  "philosopher",
  "pho",
  "phoenix",
  "phone",
  "phone booth",
  "photo",
  "photo booth",
  "photobomb",
  "pianist",
  "pickup truck",
  "pinata",
  "pine tree",
  "piston",
  "pitcher",
  "pixel",
  "Pizza Hut",
  "plague doctor",
  "plains",
  "plane",
  "plankton",
  "plant",
  "plantation",
  "plastic",
  "plastic bag",
  "plastic wrap",
  "platform",
  "playing card",
  "plexiglass",
  "pliers",
  "poker",
  "Poland",
  "police",
  "pollen",
  "polygon",
  "pomegranate",
  "Pompeii",
  "Pong",
  "pool",
  "pop",
  "pork",
  "Porsche",
  "port",
  "possessed",
  "possum",
  "pothole",
  "pottery",
  "poutine",
  "power",
  "power bank",
  "power lines",
  "power plant",
  "press",
  "price",
  "prime meridian",
  "principal",
  "prisoner",
  "prize",
  "profit",
  "prosciutto",
  "protect",
  "protection",
  "protein",
  "protester",
  "protractor",
  "Pterodactyl",
  "puberty",
  "Pug",
  "pull",
  "pulley",
  "pump",
  "punch",
  "punching bag",
  "puppy",
  "purple",
  "purr",
  "push",
  "Puss in Boots",
  "pylon",
  "python",
  "quail",
  "quarantine",
  "quarterback",
  "Queen Elizabeth",
  "quesadilla",
  "question",
  "quiche",
  "quiet",
  "race track",
  "rag",
  "rage",
  "railroad",
  "railroad crossing",
  "ramen",
  "rap",
  "rapier",
  "Rapunzel",
  "rare",
  "rattle",
  "rattlesnake",
  "reading glasses",
  "real estate",
  "reaper",
  "receipt",
  "recipe",
  "recorder",
  "red panda",
  "Red Sea",
  "Redditor",
  "redstone",
  "refresh",
  "reincarnation",
  "Renaissance",
  "reporter",
  "Republican",
  "resort",
  "retirement home",
  "rhombus",
  "rhubarb",
  "rich",
  "rifle",
  "right",
  "rim",
  "ring finger",
  "riot",
  "ripe",
  "road",
  "roadkill",
  "roadrunner",
  "roast beef",
  "robe",
  "Roblox",
  "rock climbing",
  "rock pool",
  "Rocket League",
  "rocking chair",
  "rodeo",
  "Rolex",
  "roller coaster",
  "Rollerblade",
  "romance",
  "Romeo and Juliet",
  "rope",
  "rotten",
  "rough",
  "round",
  "roundabout",
  "row",
  "rubber band",
  "Rubiks Cube",
  "ruins",
  "safety clip",
  "sailor",
  "salami",
  "salsa",
  "salute",
  "samurai",
  "sandals",
  "Sandy Cheeks",
  "sapphire",
  "sardines",
  "Satan",
  "satellite dish",
  "savanna",
  "Savannah",
  "save",
  "saw",
  "scale",
  "scales",
  "scalpel",
  "scimitar",
  "scorpion",
  "Scrabble",
  "scrambled eggs",
  "scratch",
  "screwdriver",
  "scroll",
  "sea turtle",
  "sea urchin",
  "seat",
  "section",
  "sedan",
  "seizure",
  "selfie",
  "seltzer",
  "sensor",
  "Seoul",
  "Serbia",
  "sewer",
  "shades",
  "Shaggy",
  "Shakespeare",
  "share",
  "shave",
  "shave ice",
  "sheep dog",
  "sheet",
  "shepherd",
  "sheriff",
  "shield",
  "shin",
  "ship",
  "shoehorn",
  "shogun",
  "shoot",
  "shooter",
  "shooting star",
  "shorts",
  "shot glass",
  "shrimp",
  "shrug",
  "Siberia",
  "sideburns",
  "sidewalk",
  "sign",
  "signal",
  "SIM card",
  "sip",
  "siren",
  "sitar",
  "ski lift",
  "skillet",
  "skirt",
  "slave",
  "sled",
  "sleepwalk",
  "slip",
  "slippers",
  "Slovakia",
  "smart",
  "smartphone",
  "smug",
  "snack",
  "snake charmer",
  "Snapchat",
  "sneakers",
  "Snoop Dogg",
  "Snoopy",
  "snow globe",
  "Snow White",
  "snowmobile",
  "snowstorm",
  "Socialism",
  "sock puppet",
  "solar flare",
  "solar panel",
  "Somalia",
  "song",
  "soot",
  "South Africa",
  "South America",
  "South Korea",
  "South Park",
  "South Pole",
  "Soviet Union",
  "soy",
  "spam",
  "spank",
  "speech",
  "speed",
  "speed bump",
  "speedboat",
  "speedometer",
  "spend",
  "spicy",
  "spike strips",
  "spill",
  "sports car",
  "spot",
  "Spotify",
  "spray",
  "spread",
  "Sprite",
  "sprout",
  "spur",
  "squash",
  "squat",
  "squeal",
  "Sriracha",
  "stable",
  "staff",
  "stain",
  "Stalin",
  "Starbucks",
  "start",
  "steak",
  "steal",
  "steampunk",
  "steering wheel",
  "stem",
  "Stephen Hawking",
  "stew",
  "stick",
  "stick man",
  "sticker",
  "stink",
  "stink bug",
  "Stitch",
  "stock",
  "stocking",
  "stockings",
  "Stonehenge",
  "stool",
  "stop",
  "stopwatch",
  "store",
  "storm drain",
  "street light",
  "streetcar",
  "strength",
  "stroller",
  "stubble",
  "stump",
  "subtraction",
  "suburbs",
  "suck",
  "suit",
  "sumo",
  "sunny",
  "sunshine",
  "SUV",
  "Sweden",
  "sweet potato",
  "swelling",
  "swim ring",
  "swimmer",
  "Switzerland",
  "symmetry",
  "T-shirt",
  "Taco Bell",
  "Taj Mahal",
  "talk",
  "tall",
  "tambourine",
  "tangled",
  "tap dance",
  "tape measure",
  "tapeworm",
  "TARDIS",
  "tater tots",
  "tax",
  "tea bag",
  "team",
  "tech support",
  "tee",
  "teenager",
  "Terraria",
  "Tesla",
  "Texas",
  "Thailand",
  "Thanos",
  "The Avengers",
  "The Rock",
  "theatre",
  "theremin",
  "thick",
  "thigh",
  "thorn",
  "thumbs down",
  "thumbs up",
  "Tibet",
  "tide",
  "TikTok",
  "tile",
  "time travel",
  "tinfoil",
  "tinsel",
  "tipi",
  "title",
  "toddler",
  "tofu",
  "toilet brush",
  "toilet paper",
  "Tokyo",
  "Tom Brady",
  "Tom Cat",
  "Tom Hanks",
  "tool",
  "torso",
  "tortilla",
  "Totoro",
  "tough",
  "town",
  "toxic",
  "toxic waste",
  "Toyota",
  "track",
  "trade",
  "traffic jam",
  "trail",
  "trailer park",
  "train station",
  "tram",
  "trampoline",
  "translator",
  "trapezoid",
  "trash",
  "tray",
  "trench",
  "trench coat",
  "Triceratops",
  "trip",
  "troll",
  "trousers",
  "Trump",
  "trunk",
  "tsunami",
  "tug of war",
  "tugboat",
  "tulip",
  "tumbleweed",
  "tundra",
  "tuning fork",
  "turban",
  "turn",
  "turret",
  "tutu",
  "twins",
  "Twitch",
  "typewriter",
  "Uganda",
  "Ukraine",
  "Uluru",
  "underwear",
  "uninhabited",
  "United Kingdom",
  "university",
  "upside down",
  "upstairs",
  "urn",
  "USA",
  "utility pole",
  "van",
  "Van Gogh",
  "vape",
  "vase",
  "vector",
  "vehicle",
  "veil",
  "vending machine",
  "Venice",
  "venomous",
  "ventilation",
  "Venus flytrap",
  "vest",
  "Vietnam",
  "vinyl",
  "violet",
  "Vladimir Putin",
  "wagon",
  "Wales",
  "Wall Street",
  "wallet",
  "Waluigi",
  "war",
  "wardrobe",
  "Wario",
  "warning",
  "warrior",
  "wasabi",
  "wash",
  "washing machine",
  "Washington",
  "wasteland",
  "watch tower",
  "water bottle",
  "water cooler",
  "water slide",
  "water tower",
  "watering can",
  "watermelon",
  "weakling",
  "weather vane",
  "weatherman",
  "weight",
  "wet",
  "wetsuit",
  "wheat",
  "wheelchair",
  "whip",
  "whirlpool",
  "whiskers",
  "whiskey",
  "White House",
  "whiteboard",
  "whole",
  "wind farm",
  "window sill",
  "Windows",
  "windshield wipers",
  "windsock",
  "wink",
  "wish",
  "wishing well",
  "wok",
  "woman",
  "wood",
  "workout",
  "wrap",
  "wrecking ball",
  "WWE",
  "Yahtzee",
  "yarn",
  "year",
  "yield sign",
  "yoga",
  "Yogi Bear",
  "zebra crossing",
  "Zimbabwe",
  "zodiac sign",
  "zookeeper",
  "Zoom call",
  "zucchini"
];
  
    const state = {
      initialized: false,
      running: false,
      closeHitPending: null,
      currentHintRaw: '',
      currentUnderscorePattern: '',
      currentLetterPattern: '',
      lastProcessedHint: '',
      candidates: [],
      queue: [],
      sentThisRound: new Set(),
      sentAttempts: new Map(),
      retryMap: new Map(),
      lastGuess: '',
      words: [],
      wordsLoaded: false,
      roundToken: '',
      lastError: '',
      wordCount: 0,
      loopTimer: null,
      wordGuessedThisRound: false,
      wordGuessedAt: 0,
      isUserScrolling: false,
      selectors: {
        input: null,
        send: null,
        hint: null,
        chat: null,
        roundRoot: null,
      },
      ui: null,
      observers: {
        hint: null,
        chat: null,
        round: null,
      },
      initAttempts: 0,
      automationArmed: false,
      lastGamePhase: 'unknown',
      selfName: '',
      lastChatTextLen: 0,
      roundStartChatLen: 0,
      spamBlockedUntil: 0,
      cooldownRemainingMs: 0,
      spamDetectedCount: 0,
      closeHitSent: new Set(),
      revealedWords: new Set(),
      devLog: [],
      refreshRateMs: null,
      refreshLoopScheduled: null,
      renderTopCandidatesRaf: null,
      renderTopCandidatesPending: null,
      closeHitWatchTimer: null,
      closeHitWatchStop: null,
    };
  
    function loadSettings() {
      try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        return { ...DEFAULT_SETTINGS };
      }
    }
  
    const settings = loadSettings();
  
    function saveSettings() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  
    function onReady(fn) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
        return;
      }
      fn();
    }
  
    function normalizeWord(value) {
      return (value || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
    }
  
    function cleanPatternPunctuation(value) {
      return (value || '').replace(/['".,!?()]/g, '');
    }
  
    function matchesUnderscorePattern(word, pattern) {
      const wordLower = normalizeWord(word);
      const patternLower = normalizeWord(pattern);
      const patternCleaned = cleanPatternPunctuation(patternLower);
      const wordCleaned = cleanPatternPunctuation(wordLower);
  
      if (!patternCleaned.includes('_')) return true;
      if (wordCleaned.length !== patternCleaned.length) return false;
  
      for (let i = 0; i < patternCleaned.length; i++) {
        const p = patternCleaned[i];
        const c = wordCleaned[i];
        if (p === '_') {
          if (c === ' ' || c === '-') return false;
          continue;
        }
        if (p !== c) return false;
      }
      return true;
    }
  
    function matchesLetterPattern(word, pattern) {
      if (!pattern || !pattern.trim()) return true;
      const parts = pattern.trim().split(/\s+/);
  
      if (parts.length === 1) {
        const p = parts[0];
  
        if (/^\d+$/.test(p)) {
          const count = parseInt(p, 10);
          if (word.includes(' ') || word.includes('-')) return false;
          return (word.match(/[a-zA-Z]/g) || []).length === count;
        }
  
        if (/^\d+-\d+$/.test(p)) {
          const [before, after] = p.split('-').map((n) => parseInt(n, 10));
          if (!word.includes('-') || word.includes(' ')) return false;
  
          const letters = word.match(/[a-zA-Z]/g) || [];
          if (letters.length !== before + after) return false;
  
          let letterCount = 0;
          for (let i = 0; i < word.length; i++) {
            if (/[a-zA-Z]/.test(word[i])) {
              letterCount++;
              if (letterCount === before && word[i + 1] === '-') {
                return true;
              }
            }
          }
          return false;
        }
  
        if (/^[a-zA-Z]+\d+$/.test(p)) {
          const m = p.match(/^([a-zA-Z]+)(\d+)$/);
          if (!m) return false;
          const start = m[1].toLowerCase();
          const count = parseInt(m[2], 10);
          if (word.includes(' ') || word.includes('-')) return false;
  
          const letters = word.match(/[a-zA-Z]/g) || [];
          return letters.length === start.length + count && word.toLowerCase().startsWith(start);
        }
  
        if (/^\d+[a-zA-Z]+/.test(p) && /[a-zA-Z]+\d+/.test(p)) {
          const segments = [];
          let current = '';
          let type = null;
          for (const ch of p) {
            const isDigit = /\d/.test(ch);
            const nextType = isDigit ? 'count' : 'letters';
            if (!type || type === nextType) {
              current += ch;
              type = nextType;
            } else {
              segments.push({ type, value: current });
              current = ch;
              type = nextType;
            }
          }
          if (current) segments.push({ type, value: current });
  
          if (word.includes(' ') || word.includes('-')) return false;
  
          const letters = word.match(/[a-zA-Z]/g) || [];
          let total = 0;
          let pos = 0;
  
          for (const segment of segments) {
            if (segment.type === 'count') {
              const c = parseInt(segment.value, 10);
              total += c;
              pos += c;
            } else {
              total += segment.value.length;
              for (let i = 0; i < segment.value.length; i++) {
                if ((letters[pos + i] || '').toLowerCase() !== segment.value[i].toLowerCase()) {
                  return false;
                }
              }
              pos += segment.value.length;
            }
          }
  
          return letters.length === total;
        }
  
        if (/^\d+[a-zA-Z]+$/.test(p)) {
          const m = p.match(/^(\d+)([a-zA-Z]+)$/);
          if (!m) return false;
          const count = parseInt(m[1], 10);
          const ending = m[2].toLowerCase();
          if (word.includes(' ') || word.includes('-')) return false;
  
          const letters = word.match(/[a-zA-Z]/g) || [];
          return letters.length === count + ending.length && word.toLowerCase().endsWith(ending);
        }
      }
  
      if (parts.every((p) => /^\d+$/.test(p))) {
        const wordParts = word.split(/\s+/);
        if (wordParts.length !== parts.length) return false;
        return wordParts.every((wordPart, i) => {
          const expected = parseInt(parts[i], 10);
          return wordPart.replace(/[^a-zA-Z]/g, '').length === expected;
        });
      }
  
      return true;
    }
  
    function convertToLetterPattern(p) {
      const cleaned = cleanPatternPunctuation(p || '');
  
      if (cleaned.includes(' ')) {
        const words = cleaned.split(' ');
        return words
          .map((word) => (word.match(/_/g) || []).length + (word.match(/[a-z]/gi) || []).length)
          .join(' ');
      }
  
      if (cleaned.includes('-')) {
        const parts = cleaned.split('-');
        if (parts.length === 2) {
          const before = (parts[0].match(/[_a-z]/gi) || []).length;
          const after = (parts[1].match(/[_a-z]/gi) || []).length;
          return `${before}-${after}`;
        }
      }
  
      const known = [];
      let totalLength = 0;
  
      for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (ch === '_' || /[a-z]/i.test(ch)) {
          totalLength++;
          if (/[a-z]/i.test(ch)) known.push({ pos: totalLength, letter: ch });
        }
      }
  
      if (known.length === 1) {
        const k = known[0];
        return `${k.pos - 1}${k.letter}${totalLength - k.pos}`;
      }
  
      return totalLength ? String(totalLength) : '';
    }
  
    function parseHint(rawHint) {
      const hint = normalizeWord(rawHint);
      const underscorePattern = hint;
      const letterPattern = hint.includes('_') ? convertToLetterPattern(hint) : '';
      return { hint, underscorePattern, letterPattern };
    }
  
    function rankCandidates(candidates, pattern) {
      const patternKnownCount = (pattern.match(/[a-z]/gi) || []).length;
      return candidates
        .map((word) => {
          const normalized = normalizeWord(word);
          const score =
            patternKnownCount * 10 +
            (normalized.includes('-') ? 1 : 0) +
            (normalized.includes(' ') ? 2 : 0) +
            normalized.length / 100;
          return { word, score };
        })
        .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
        .map((x) => x.word);
    }
  
    function uniqueCaseInsensitive(values) {
      const seen = new Set();
      const out = [];
      for (const value of values) {
        const n = normalizeWord(value);
        if (!n || seen.has(n)) continue;
        seen.add(n);
        out.push(n);
      }
      return out;
    }
  
    function persistWordCache() {
      try {
        localStorage.setItem(
          WORD_CACHE_KEY,
          JSON.stringify({ version: '1', savedAt: Date.now(), words: state.words })
        );
      } catch {
        // ignore cache write failures
      }
    }
  
    function addWordToList(rawWord) {
      const cleaned = normalizeWord(rawWord);
      if (!cleaned) {
        setStatus('Word add ignored (empty)');
        return;
      }
  
      const exists = state.words.some((w) => normalizeWord(w) === cleaned);
      if (exists) {
        setStatus(`Word already exists: ${cleaned}`);
        return;
      }
  
      state.words.push(cleaned);
      state.words = uniqueCaseInsensitive(state.words);
      state.wordCount = state.words.length;
      persistWordCache();
      refreshCandidates('word added');
      setStatus(`Word added: ${cleaned}`);
    }
  
    function removeWordFromList(rawWord) {
      const cleaned = normalizeWord(rawWord);
      if (!cleaned) {
        setStatus('Word remove ignored (empty)');
        return;
      }
  
      const before = state.words.length;
      state.words = state.words.filter((w) => normalizeWord(w) !== cleaned);
      state.wordCount = state.words.length;
  
      if (state.words.length === before) {
        setStatus(`Word not found: ${cleaned}`);
        return;
      }
  
      persistWordCache();
      refreshCandidates('word removed');
      setStatus(`Word removed: ${cleaned}`);
    }
  
    function dedupeWordList() {
      const before = state.words.length;
      state.words = uniqueCaseInsensitive(state.words);
      state.wordCount = state.words.length;
      persistWordCache();
      refreshCandidates('word dedupe');
      setStatus(`Dedupe complete: removed ${before - state.words.length}`);
    }
  
    async function loadWords() {
      try {
        const cached = JSON.parse(localStorage.getItem(WORD_CACHE_KEY) || 'null');
        if (cached && Array.isArray(cached.words) && cached.words.length > 3000) {
          state.words = uniqueCaseInsensitive(cached.words);
          state.wordCount = state.words.length;
          state.wordsLoaded = state.words.length > 0;
          setStatus(`Word list loaded from cache: ${state.wordCount}`);
          return;
        }
      } catch {
        // fallback to rebuild cache
      }
  
      const urls = [
        'https://raw.githubusercontent.com/Sv443/skribblio-word-lists/master/en_words.txt',
        'https://raw.githubusercontent.com/luukdv/scribblio-wordlist/master/words/en.txt',
        'https://cdn.jsdelivr.net/gh/Sv443/skribblio-word-lists@master/en_words.txt',
      ];
  
      const merged = [...BUNDLED_WORDS];
  
      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const text = await res.text();
          merged.push(...text.split(/\r?\n/));
        } catch {
          // non-fatal
        }
      }
  
      state.words = uniqueCaseInsensitive(merged);
      state.wordCount = state.words.length;
      state.wordsLoaded = state.words.length > 0;
  
      persistWordCache();
  
      setStatus(state.wordsLoaded ? `Word list built + cached: ${state.words.length}` : 'Word list unavailable');
    }
  
  
    function isVisibleElement(el) {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
  
    function querySelectorAny(selectors, visibleOnly = false) {
      for (const selector of selectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        const found = visibleOnly ? nodes.find((node) => isVisibleElement(node)) : nodes[0];
        if (found) return found;
      }
      return null;
    }
  
    function bindGameSelectors() {
      state.selectors.hint = querySelectorAny([
        '#currentWord',
        '.current-word',
        '.word .hints',
        '.wordHints',
        '.hints',
        '[class*="current"][class*="word"]',
        '[class*="word"] [class*="hint"]',
        '.word',
      ], true);
  
      state.selectors.chat = querySelectorAny([
        '.chat-content',
        '.chat .content',
        '.chatMessages',
        '[class*="chat"] [class*="content"]',
      ]);
  
      state.selectors.input = querySelectorAny([
        'input[placeholder*="guess" i]',
        'input[placeholder*="Type your guess" i]',
        '#inputChat',
        '.chat-form input[type="text"]',
        '.chat input[type="text"]',
        'input[type="text"]',
      ], true);
  
      state.selectors.send = querySelectorAny([
        '.chat-form button[type="submit"]',
        '.chat form button',
        '.chat button',
        'button[type="submit"]',
      ]);
  
      state.selectors.roundRoot = querySelectorAny([
        '#game-wrapper',
        '#gameContainer',
        '.game',
        'main',
        'body',
      ]);
  
      return Boolean(state.selectors.hint || state.selectors.chat || state.selectors.input);
    }
  
    function sanitizeHintText(text) {
      return (text || '')
        .replace(/\s+/g, ' ')
        .replace(/[|]/g, ' ')
        .trim()
        .toLowerCase();
    }
  
    function isLikelyHintPattern(text) {
      if (!text) return false;
      if (text.length > 48) return false;
      if (!/^[a-z_\-\s]+$/.test(text)) return false;
      if (!text.includes('_')) return false;
      return true;
    }
  
    function findHintCandidateText() {
      const hintSources = [
        state.selectors.hint,
        querySelectorAny(['#currentWord', '.current-word', '.wordHints', '.word .hints', '.hints'], true),
      ].filter(Boolean);
  
      for (const node of hintSources) {
        const t = sanitizeHintText(node.textContent || '')
          .replace(/[^a-z_\-\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
  
        if (isLikelyHintPattern(t)) return t;
      }
  
      const guessLabel = Array.from(document.querySelectorAll('div,span,strong,h1,h2')).find((el) =>
        /guess this/i.test(el.textContent || '')
      );
  
      if (guessLabel?.parentElement) {
        const cleaned = sanitizeHintText(guessLabel.parentElement.textContent || '')
          .replace(/guess this/ig, '')
          .replace(/[^a-z_\-\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (isLikelyHintPattern(cleaned)) return cleaned;
      }
  
      return '';
    }
  
  
    function extractLengthFromHintArea() {
      const candidates = [
        document.querySelector('#currentWordLength'),
        document.querySelector('.word-length'),
        document.querySelector('.wordLength'),
        state.selectors.hint && state.selectors.hint.parentElement,
        Array.from(document.querySelectorAll('div,span,strong')).find((el) => /guess this/i.test(el.textContent || '')),
      ].filter(Boolean);
  
      for (const el of candidates) {
        const nums = (el.textContent || '').match(/\b(\d{1,2})\b/g);
        if (!nums || !nums.length) continue;
        const val = parseInt(nums[nums.length - 1], 10);
        if (val >= 2 && val <= 25) return val;
      }
  
      return null;
    }
  
  
  
    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  
    function getSelfName() {
      if (state.selfName) return state.selfName;

      // Collect all elements that contain "(you)" anywhere in their text
      const candidates = Array.from(document.querySelectorAll('div,span,li,p'))
        .filter(el => /\(you\)/i.test(el.textContent || ''));

      if (!candidates.length) return '';

      // The most specific element is the shortest one — avoids grabbing a huge parent container
      candidates.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      const youNode = candidates[0];

      const raw = (youNode.textContent || '')
        .replace(/\(you\)/ig, '')      // remove "(you)" label
        .replace(/\d+\s*points?/ig, '') // remove "40 points"
        .replace(/#\d+/g, '')           // remove "#1375" rank suffixes
        .replace(/\s+/g, ' ')
        .trim();

      if (!raw) return '';

      // If we still ended up with a long string (wrong element), take just the first word
      const name = raw.length > 40 ? raw.split(/\s+/)[0] : raw;

      state.selfName = name.toLowerCase();
      return state.selfName;
    }
  
    function isBetweenRoundOverlayVisible() {
      const statusNodes = [
        ...document.querySelectorAll('.round, .status, .info, .announcement, .result, [class*="round"], [class*="result"]'),
      ].filter((el) => isVisibleElement(el));
  
      for (const el of statusNodes) {
        const t = (el.textContent || '').toLowerCase().trim();
        if (!t || t.length > 120) continue;
        if (/\bthe word was\b/.test(t) || /\bround over\b/.test(t) || /\bnext round\b/.test(t)) {
          return true;
        }
      }
  
      return false;
    }
  
    function isBetweenWordsVisible() {
      const statusNodes = [
        ...document.querySelectorAll('.round, .status, .info, .announcement, [class*="round"], [class*="status"]'),
      ].filter((el) => isVisibleElement(el));
  
      for (const el of statusNodes) {
        const t = (el.textContent || '').toLowerCase().trim();
        if (!t || t.length > 160) continue;
        if (/\bis choosing a word\b/.test(t) || /\bchoose a word\b/.test(t) || /\bpick a word\b/.test(t)) {
          return true;
        }
      }
  
      return false;
    }
  
  
    function getGamePhase() {
      const input = state.selectors.input;
      const hasWordChoices = Boolean(querySelectorAny(['.wordChoices', '.word-choices', '[class*="choose"] [class*="word"]'], true));
  
      if (hasWordChoices) return 'choosing';
      if (isBetweenWordsVisible()) return 'between-words';
  
      const drawingBanner = querySelectorAny([
        '.info',
        '.status',
        '.round',
        '[class*="draw"] [class*="info"]',
        '[class*="status"]',
      ], true);
  
      const bannerText = (drawingBanner?.textContent || '').toLowerCase();
      if (/you are drawing|you are the drawer|you are drawing now/.test(bannerText)) return 'drawing';
  
      if (isBetweenRoundOverlayVisible()) return 'between-rounds';
  
      const hint = findHintCandidateText();
      const hasHint = Boolean(hint) || Boolean(extractLengthFromHintArea());
      const canTypeGuess = Boolean(input && !input.disabled && !input.readOnly && /guess/i.test(input.placeholder || ''));
  
      if (canTypeGuess && hasHint) return 'guessing';
      if (canTypeGuess) return 'waiting-hint';
      return 'unknown';
    }
  
  
    function isAutomationAllowed() {
      const phase = getGamePhase();
      state.lastGamePhase = phase;
      return phase === 'guessing';
    }
  
    function getHintText() {
      let hint = findHintCandidateText();
  
      if (!hint) {
        const len = extractLengthFromHintArea();
        if (len) return '_'.repeat(len);
        return '';
      }
  
      hint = hint
        .replace(/[^a-z_\-\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
  
      if (!hint.includes('_')) {
        const len = extractLengthFromHintArea();
        if (len) hint = '_'.repeat(len);
      }
  
      return hint;
    }
  
    function setStatus(text, isError = false) {
      if (!state.ui) return;
      state.lastError = isError ? text : '';
      state.ui.status.textContent = text;
      state.ui.status.style.color = isError ? '#b00020' : '#2d3748';
    }
  
    function refreshCandidates(reason = 'update') {
      const rawHint = getHintText();
      state.currentHintRaw = rawHint;
  
      const { hint, underscorePattern, letterPattern } = parseHint(rawHint);
      state.currentUnderscorePattern = underscorePattern;
      state.currentLetterPattern = letterPattern;

      if (!isAutomationAllowed()) {
        state.candidates = [];
        state.queue = [];
        renderDebug(`${reason} (${state.lastGamePhase})`);
        return;
      }

      if (state.wordGuessedThisRound) {
        // isAutomationAllowed() passed above, meaning phase === 'guessing'.
        // Only auto-recover after a grace period: skribbl stays in "guessing" phase
        // while other players are still guessing the same word, so we must not
        // mistake that window for a missed round transition.
        // 45 s covers a full skribbl round timer — the chat "the word was" signal
        // should always arrive well before then if the round ends naturally.
        const gracePassed = Date.now() - state.wordGuessedAt > 45000;
        if (gracePassed && rawHint && /_/.test(rawHint)) {
          devLog('round', `Auto-recovering: guessing phase while word-guessed (hint: "${rawHint}")`);
          startNewRound();
          return;
        }
        hideCandidates();
        renderDebug(reason);
        return;
      }

      const hintChanged = rawHint !== state.lastProcessedHint;

      if (hintChanged) {
        devLog('hint', `Hint changed: "${state.lastProcessedHint || '—'}" → "${rawHint || '—'}"`);
      }

      // NOTE: do NOT clear revealedWords here yet — queue build below depends on it.
      // We clear it AFTER the queue is built so the previous round's word is still blocked.
      state.lastProcessedHint = rawHint;

      let candidates = state.words.slice();
  
      if (letterPattern) {
        candidates = candidates.filter((word) => matchesLetterPattern(word, letterPattern));
      }
  
      if (hint && hint.includes('_')) {
        candidates = candidates.filter((word) => matchesUnderscorePattern(word, hint));
      }
  
      state.candidates = rankCandidates(uniqueCaseInsensitive(candidates), hint).slice(0, LIMITS.queueBurstLimit);
  
      if (state.running) {
        buildQueueFromCandidates({ preserveExisting: !hintChanged });
        // If the tick loop died (e.g. resetRoundState cleared loopTimer), restart it now that
        // the queue has been freshly populated. startAutomation will override this if it runs next.
        if (state.queue.length > 0 && !state.loopTimer) {
          scheduleNextTick(Math.max(60, Math.min(getConfiguredDelay(), 300)));
        }
      }

      // Clear revealedWords AFTER the queue is built so revealed words are blocked on the first build.
      if (hintChanged && /_/.test(rawHint)) {
        state.revealedWords.clear();
      }
  
      renderDebug(reason);
      renderTopCandidates();
    }
  
    function buildQueueFromCandidates(options = {}) {
      const { preserveExisting = true } = options;
  
      const queue = preserveExisting ? state.queue.slice() : [];
      const queuedSet = new Set(queue);
  
      for (const word of state.candidates) {
        const n = normalizeWord(word);
        if (!n || n.length < LIMITS.minGuessLength) continue;
        if (!isValidGuessText(n)) continue;
        if (state.sentThisRound.has(n) || (state.sentAttempts.get(n) || 0) > 0) continue;
        if (state.revealedWords.has(n) || queuedSet.has(n)) continue;
        queue.push(n);
        queuedSet.add(n);
      }
  
      state.queue = queue;
    }
  
    function stopAutomation(reason = 'Stopped') {
      state.running = false;
      if (state.loopTimer) {
        clearTimeout(state.loopTimer);
        state.loopTimer = null;
      }
      // Clear any pending candidate render and show a "stopped" placeholder
      // so the word list doesn't linger after the bot is halted.
      if (state.renderTopCandidatesRaf != null) {
        cancelAnimationFrame(state.renderTopCandidatesRaf);
        state.renderTopCandidatesRaf = null;
        state.renderTopCandidatesPending = null;
      }
      if (state.ui?.candidateTop && !state.wordGuessedThisRound) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:8px;text-align:center;color:#999;font-size:10px;';
        wrap.textContent = 'Bot stopped. Click Start to resume.';
        state.ui.candidateTop.innerHTML = '';
        state.ui.candidateTop.appendChild(wrap);
      }
      setStatus(reason);
      renderDebug('stopped');
      devLog('info', `Automation stopped: ${reason}`);
    }
  
    function setNativeValue(element, value) {
      const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  
      if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
      } else if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        element.value = value;
      }
    }
  
    function canSendWithoutSpamKick() {
      if (state.spamDetectedCount >= 2) return false;
      if (Date.now() < state.spamBlockedUntil) return false;
      return true;
    }

    function isValidGuessText(text) {
      const t = (text || '').trim();
      if (t.length < LIMITS.minGuessLength) return false;
      if (/[\r\n]/.test(t)) return false;
      if (t.includes(':')) return false;
      if (/\b(guessed the word|is drawing now|left the room|joined the room)\b/i.test(t)) return false;
      return true;
    }

    // ── Close-hit watcher ──────────────────────────────────────────────────────
    // Activated immediately when a dot-prefixed word is sent. Polls the last 3
    // chat DOM elements every closeHitScanMs ms for up to closeHitScanTimeout ms.
    // Much more reliable than waiting for a chat MutationObserver delta because it
    // reads individual message elements directly, so rapid chat can't bury the signal.
    function stopCloseHitWatch() {
      if (state.closeHitWatchTimer) {
        clearInterval(state.closeHitWatchTimer);
        state.closeHitWatchTimer = null;
      }
      if (state.closeHitWatchStop) {
        clearTimeout(state.closeHitWatchStop);
        state.closeHitWatchStop = null;
      }
    }

    function startCloseHitWatch(word) {
      stopCloseHitWatch();
      if (!settings.dotPrefix) return;

      const cleaned = (word || '').replace(/^\./, '').trim();
      const normalized = normalizeWord(cleaned);
      if (!normalized || normalized.length < LIMITS.minGuessLength) return;
      if (state.closeHitSent.has(normalized)) return;

      const scanMs = Math.max(LIMITS.closeHitScanMin, Math.min(LIMITS.closeHitScanMax, settings.closeHitScanMs ?? DEFAULT_SETTINGS.closeHitScanMs));

      const tryDetect = () => {
        if (state.wordGuessedThisRound || state.closeHitSent.has(normalized) || !state.selectors.chat) {
          stopCloseHitWatch();
          return;
        }
        // Check last 3 chat message elements individually so rapid chat can't bury the line
        const children = Array.from(state.selectors.chat.children).slice(-3);
        const recentText = children.map(el => el.textContent || '').join('\n');
        const closeMatch = recentText.match(/\s*(?:\.)?([^\s.!?,]+(?:\s+[^\s.!?,]+)*)\s+is\s+close!/i);
        if (closeMatch) {
          const found = normalizeWord((closeMatch[1] || '').replace(/^\.+/, ''));
          if (found === normalized) {
            stopCloseHitWatch();
            devLog('chat', `Close-hit (watcher): "${cleaned}" — resending without dot`);
            state.closeHitSent.add(normalized); // mark immediately to prevent re-detection
            if (canSendWithoutSpamKick()) {
              sendGuess(cleaned, { noDot: true });
              state.closeHitPending = null;
              renderTopCandidates();
            } else {
              enqueueCloseRetry(cleaned);
            }
          }
        }
      };

      state.closeHitWatchTimer = setInterval(tryDetect, scanMs);
      state.closeHitWatchStop = setTimeout(stopCloseHitWatch, LIMITS.closeHitScanTimeout);
    }
    // ── End close-hit watcher ─────────────────────────────────────────────────

    function sendGuess(text, options) {
      options = options || {};
      const trimmed = (text || '').trim();
      if (trimmed.length < LIMITS.minGuessLength) {
        return false;
      }
      if (!isValidGuessText(trimmed)) {
        return false;
      }
      const input = state.selectors.input;
      if (!input || input.disabled || input.readOnly) {
        setStatus('Chat input not found/usable', true);
        return false;
      }

      if (!canSendWithoutSpamKick()) {
        setStatus('Blocked: spam risk (2+ detections)', true);
        return false;
      }

      let out = trimmed;
      if (!options.noDot) {
        if (settings.dotPrefix && out && !out.startsWith('.')) out = '.' + out;
        else if (!settings.dotPrefix && out && out.startsWith('.')) out = out.slice(1);
      } else if (out && out.startsWith('.')) {
        out = out.slice(1);
      }

      input.focus();
      setNativeValue(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setNativeValue(input, out);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
  
      const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
      input.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
      input.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
      input.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
  
      const form = input.closest('form');
      if (form) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
  
      if (state.selectors.send && !state.selectors.send.disabled) {
        state.selectors.send.click();
      }
  
      state.lastGuess = out;
      state.ui.lastGuess.textContent = out || '-';
      state.sentThisRound.add(normalizeWord(out.replace(/^\./, '')));
      devLog('guess', `Sent: "${out}"`);

      // If we just sent a dot-prefixed word, immediately start the dedicated close-hit
      // watcher. It polls individual chat DOM elements every closeHitScanMs ms so it
      // can't miss the ".word is close!" message even when chat is moving fast.
      if (settings.dotPrefix && !options.noDot && out.startsWith('.')) {
        startCloseHitWatch(trimmed);
      }

      return true;
    }
  
    function enqueueCloseRetry(word) {
      const n = normalizeWord(word);
      if (!n) return;
      const retries = state.retryMap.get(n) || 0;
      if (retries >= LIMITS.maxRetries) return;
      state.retryMap.set(n, retries + 1);
      state.closeHitPending = n;
      if (!state.running) return;
      const waitForCooldown = state.spamBlockedUntil > Date.now() ? Math.min(state.spamBlockedUntil - Date.now() + 50, 2000) : 0;
      const soonMs = Math.max(200, Math.min(500, getConfiguredDelay()));
      const waitMs = waitForCooldown > 0 ? Math.min(waitForCooldown, LIMITS.tickPollMs) : soonMs;
      if (state.loopTimer) {
        clearTimeout(state.loopTimer);
        state.loopTimer = null;
      }
      state.loopTimer = setTimeout(() => {
        state.loopTimer = null;
        tickQueue(false);
      }, waitMs);
    }
  
  
    function getConfiguredDelay() {
      const parsed = Number(settings.delayMs);
      const safe = Number.isFinite(parsed) ? parsed : DEFAULT_SETTINGS.delayMs;
      return Math.max(LIMITS.delayMin, Math.min(LIMITS.delayMax, safe));
    }
  
    function scheduleNextTick(waitMs) {
      if (state.loopTimer) {
        clearTimeout(state.loopTimer);
        state.loopTimer = null;
      }
      state.loopTimer = setTimeout(() => {
        state.loopTimer = null;
        tickQueue(false);
      }, Math.max(0, waitMs));
    }
  
    function tickQueue(immediate = false) {
      if (!state.running) return;
      if (state.wordGuessedThisRound) return;
      const delay = getConfiguredDelay();
  
      if (!canSendWithoutSpamKick()) {
        state.cooldownRemainingMs = state.spamBlockedUntil > Date.now() ? Math.max(0, state.spamBlockedUntil - Date.now()) : 0;
        setStatus(state.spamDetectedCount >= 2 ? 'Paused: spam risk (avoid 3rd strike)' : `Running (paused: spam ${Math.ceil(state.cooldownRemainingMs / 1000)}s)`);
        renderDebug('spam cooldown');
        scheduleNextTick(Math.min(LIMITS.tickPollMs, Math.max(50, delay)));
        return;
      }

      state.cooldownRemainingMs = 0;
  
      if (!isAutomationAllowed()) {
        setStatus(`Running (paused: ${state.lastGamePhase})`);
        renderDebug('paused phase');
        scheduleNextTick(Math.min(LIMITS.tickPollMs, Math.max(80, delay)));
        return;
      }
  
      if (state.closeHitPending) {
        const word = state.closeHitPending;
        state.closeHitPending = null;
        if (sendGuess(word, { noDot: true })) {
          state.closeHitSent.add(normalizeWord(word));
          setStatus(`Close-hit retry sent (no dot): ${word}`);
        }
      } else {
        let next = state.queue.shift();
        while (next && (
          next.length < LIMITS.minGuessLength ||
          !next.trim() ||
          !isValidGuessText(next) ||
          state.revealedWords.has(normalizeWord(next)) ||
          state.sentThisRound.has(normalizeWord(next))
        )) {
          next = state.queue.shift();
        }
        if (!next) {
          refreshCandidates('queue empty');
          setStatus('Running (paused: waiting for new letters/word)');
          renderDebug('queue empty wait');
          scheduleNextTick(Math.min(LIMITS.tickPollMs, Math.max(80, delay)));
          return;
        }

        state.sentAttempts.set(next, (state.sentAttempts.get(next) || 0) + 1);
        if (sendGuess(next)) {
          setStatus(`Sent guess: ${settings.dotPrefix ? '.' + next : next}`);
          renderTopCandidates();
        } else {
          setStatus(`Send failed, skipped: ${next}`, true);
        }
      }
  
      renderDebug('tick');
      scheduleNextTick(immediate ? delay : delay);
    }
  
  
    function startAutomation() {
      if (!state.wordsLoaded) {
        setStatus('Words still loading...', true);
        return;
      }

      if (!state.selectors.input) {
        bindGameSelectors();
        if (!state.selectors.input) {
          setStatus('Cannot start: chat input missing', true);
          return;
        }
      }

      state.wordGuessedThisRound = false;
      state.running = true;
      state.automationArmed = true;
      state.queue = [];
      state.sentAttempts.clear();
      state.closeHitPending = null;
      // Anchor close-hit scanning to the current chat position so the poller and
      // round-scan fallback never look at messages from before the bot was started.
      if (state.selectors.chat) {
        const chatLen = (state.selectors.chat.textContent || '').length;
        if (chatLen > state.roundStartChatLen) state.roundStartChatLen = chatLen;
        if (chatLen > state.lastChatTextLen) state.lastChatTextLen = chatLen;
      }
      devLog('info', `Automation started — ${state.candidates.length} candidates, hint: "${state.currentHintRaw || '—'}"`);
      refreshCandidates('start');
      setStatus('Running');
      renderDebug('running');
      const kickoffDelay = Math.max(60, Math.min(getConfiguredDelay(), 500));
      scheduleNextTick(kickoffDelay);
    }
  
    function resetRoundState(reason = 'Round reset') {
      if (state.loopTimer) {
        clearTimeout(state.loopTimer);
        state.loopTimer = null;
      }
      // Stop any in-flight close-hit watcher so it doesn't fire into the new round.
      stopCloseHitWatch();
      // Mark where in the chat this round starts so the close-hit fallback only
      // scans the current round's messages and won't re-fire on previous rounds.
      state.roundStartChatLen = state.lastChatTextLen;
      state.sentThisRound.clear();
      // Carry revealed words into sentThisRound so they stay blocked for the new round's queue builds
      state.revealedWords.forEach(w => state.sentThisRound.add(w));
      state.closeHitSent.clear();
      state.sentAttempts.clear();
      state.retryMap.clear();
      state.closeHitPending = null;
      state.queue = [];
      state.lastGuess = '';
      state.lastProcessedHint = '';
      state.selfName = ''; // re-detect name each round in case it changed
      if (state.ui) {
        state.ui.lastGuess.textContent = '-';
      }
      if (state.running) {
        setStatus(`Running (paused: ${reason.toLowerCase()})`);
      }
      if (!state.wordGuessedThisRound) {
        refreshCandidates(reason);
      } else {
        renderDebug(reason);
      }
    }

    function startNewRound() {
      state.wordGuessedThisRound = false;
      state.spamDetectedCount = 0;
      state.spamBlockedUntil = 0;
      state.cooldownRemainingMs = 0;
      devLog('round', 'New round started — resetting state');
      resetRoundState('New round');
    }
  
    function parseChatSignals(rootText) {
      const fullText = rootText || '';
  
      if (fullText.length < state.lastChatTextLen) {
        // Chat was cleared or re-rendered — reset position without reprocessing history
        state.lastChatTextLen = fullText.length;
        return;
      }
  
      const delta = fullText.slice(state.lastChatTextLen);
      state.lastChatTextLen = fullText.length;
      const recent = delta.toLowerCase();
      if (!recent.trim()) return;
  
      if (/spam detected|sending messages too quickly/.test(recent)) {
        state.spamDetectedCount = (state.spamDetectedCount || 0) + 1;
        // Exponential backoff: 3s → 7s → stop.  Each strike doubles the wait so the
        // bot can't recover quickly enough to trigger the server kick on the 3rd strike.
        const backoff = Math.min(2000 * (1 << state.spamDetectedCount), 12000); // 4s, 8s, 12s cap
        state.spamBlockedUntil = Date.now() + backoff;
        if (state.spamDetectedCount >= 2) {
          // Two strikes — stop the automation completely; user can restart manually.
          devLog('round', `Spam risk: ${state.spamDetectedCount} detections — stopping to avoid kick`);
          stopAutomation('Spam risk: stopped to avoid kick');
        } else {
          setStatus(`Running (paused: spam cooldown ${Math.ceil(backoff / 1000)}s)`);
        }
        return;
      }
  
      // System message "The word was 'X'" is NOT preceded by "name: "
      // A user typing it would appear as "name: the word was 'X'" (with a colon)
      const isRoundEndSystemMessage = (text) => {
        const lc = (text || '').toLowerCase();
        const idx = lc.indexOf("the word was '");
        if (idx !== -1) {
          const before = lc.slice(Math.max(0, idx - 12), idx);
          if (!before.includes(':')) return true;
        }
        return /\bround over\b/i.test(text);
      };
      if (/\bthe word was\b|\bround over\b/.test(recent) && isRoundEndSystemMessage(recent)) {
        const revealedWords = [];
        const wordWasRe = /\bthe word was\s*'([^']+)'/gi;
        let m;
        while ((m = wordWasRe.exec(fullText)) !== null) {
          const w = normalizeWord(m[1]);
          if (w && w.length >= LIMITS.minGuessLength) revealedWords.push(w);
        }
        revealedWords.forEach((w) => {
          state.closeHitSent.add(w);
          state.revealedWords.add(w);
        });
        if (state.closeHitPending && revealedWords.includes(normalizeWord(state.closeHitPending))) {
          state.closeHitPending = null;
        }
        state.wordGuessedThisRound = true;
        state.wordGuessedAt = Date.now();
        devLog('round', 'Round ended — "the word was" / "round over" detected');
        hideCandidates();
        if (/\bis drawing now\b|\bis choosing a word\b|\bchoose a word\b|\bpick a word\b/.test(recent)) {
          startNewRound();
        }
        return;
      }
  
      // ── Close-hit detection ──────────────────────────────────────────────────
      // IMPORTANT: this block runs BEFORE the ownSolved check so that when Skribbl
      // delivers ".word is close!" and "bugatti guessed the word!" in the SAME DOM
      // mutation batch, we still process (and send) the close-hit resend first.
      // tryCloseHitSend guards against sending after round end via wordGuessedThisRound.
      function tryCloseHitSend(text) {
        if (state.wordGuessedThisRound) return false;
        const close = (text || '').match(/\s*(?:\.)?([^\s.!?,]+(?:\s+[^\s.!?,]+)*)\s+is\s+close!/i);
        if (!close || !close[1]) return false;
        const word = close[1].trim().replace(/^\.+/, '');
        const normalized = normalizeWord(word);
        if (!normalized || normalized.length < LIMITS.minGuessLength || !isValidGuessText(word) || state.closeHitSent.has(normalized)) return false;
        devLog('chat', `Close-hit detected: "${word}" — resending without dot`);
        // Mark as handled immediately so no other detector re-fires for this word,
        // even if the send is temporarily blocked by spam cooldown.
        state.closeHitSent.add(normalized);
        if (canSendWithoutSpamKick()) {
          sendGuess(word, { noDot: true });
          state.closeHitPending = null;
          renderTopCandidates();
        } else {
          enqueueCloseRetry(word);
        }
        return true;
      }

      // Primary close-hit check: the current delta.
      tryCloseHitSend(recent);

      // Round-chat fallback: scan everything since this round started for any close-hit
      // that landed in a previously skipped batch. roundStartChatLen keeps this safe
      // (we never look at previous rounds' history).
      if (!state.wordGuessedThisRound) {
        const roundChat = fullText.slice(state.roundStartChatLen);
        if (roundChat.length > recent.length) {
          const closeRe = /\s*(?:\.)?([^\s.!?,]+(?:\s+[^\s.!?,]+)*)\s+is\s+close!/gi;
          let cm;
          while ((cm = closeRe.exec(roundChat)) !== null) {
            const w = cm[1].trim().replace(/^\.+/, '');
            const n = normalizeWord(w);
            if (n && n.length >= LIMITS.minGuessLength && isValidGuessText(w) && !state.closeHitSent.has(n)) {
              devLog('chat', `Close-hit detected (round-scan): "${w}" — resending without dot`);
              state.closeHitSent.add(n); // mark immediately to prevent re-detection
              if (canSendWithoutSpamKick()) {
                sendGuess(w, { noDot: true });
                state.closeHitPending = null;
                renderTopCandidates();
              } else {
                enqueueCloseRetry(w);
              }
              break;
            }
          }
        }
      }
      // ── End close-hit detection ───────────────────────────────────────────────

      const ownName = getSelfName();

      // "You guessed the word!" is a system message (no "name: " prefix).
      // Require no colon in the 15 chars before it so player chat like
      // "bugatti: you guessed the word!" doesn't trigger a false positive.
      const ownGuessIdx = recent.indexOf('you guessed the word!');
      const isOwnGuessSysMsg = ownGuessIdx !== -1 &&
        !recent.slice(Math.max(0, ownGuessIdx - 15), ownGuessIdx).includes(':');

      const ownSolved = isOwnGuessSysMsg ||
        (ownName && new RegExp(`\\b${escapeRegExp(ownName)}\\s+guessed the word!`, 'i').test(recent));

      const ownDrawing = ownName && (
        new RegExp(`\\b${escapeRegExp(ownName)}\\s+is drawing now!`, 'i').test(recent) ||
        new RegExp(`\\b${escapeRegExp(ownName)}\\s+is choosing a word`, 'i').test(recent)
      );

      if (ownSolved || ownDrawing) {
        devLog('chat', ownSolved
          ? `You guessed the word! Stopping automation.`
          : `You are drawing now. Stopping automation.`);
        state.wordGuessedThisRound = true;
        state.wordGuessedAt = Date.now();
        hideCandidates();
        if (state.running) {
          stopAutomation('Solved word detected, stopped');
        }
        // If the next round's transition signal arrived in the SAME delta (common when
        // guessing + "X is drawing now!" are batched), process it before returning so
        // the new round isn't silently missed.
        if (/\bis drawing now\b|\bis choosing a word\b|\bchoose a word\b|\bpick a word\b/.test(recent)) {
          startNewRound();
        }
        return;
      }

      const transitionRe = /\bis drawing now\b|\bis choosing a word\b|\bchoose a word\b|\bpick a word\b/;
      if (transitionRe.test(recent)) {
        const wordWasRe = /\bthe word was\s*'([^']+)'/gi;
        let m;
        while ((m = wordWasRe.exec(fullText)) !== null) {
          const w = normalizeWord(m[1]);
          if (w && w.length >= LIMITS.minGuessLength) {
            state.revealedWords.add(w);
            state.closeHitSent.add(w);
          }
        }
        startNewRound();
      } else if (state.wordGuessedThisRound) {
        // Fallback: scan this round's full chat for a transition signal that may have been
        // missed in a previous delta batch (same pattern as the close-hit fallback).
        // Safe because roundStartChatLen is reset each new round.
        const roundChat = fullText.slice(state.roundStartChatLen);
        if (roundChat.length > recent.length && transitionRe.test(roundChat)) {
          devLog('round', 'Transition fallback: found missed "is drawing now" in round chat');
          startNewRound();
        }
      }

    }
  
  
    async function copyTextToClipboard(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch {
        // fallback below
      }
  
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  
    function hideCandidates() {
      if (state.renderTopCandidatesRaf != null) {
        cancelAnimationFrame(state.renderTopCandidatesRaf);
        state.renderTopCandidatesRaf = null;
        state.renderTopCandidatesPending = null;
      }
      if (state.ui?.candidateTop) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:8px;text-align:center;color:#999;font-size:10px;';
        wrap.innerHTML = 'Word guessed! Waiting for next round… ';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Not guessed? Show words';
        btn.style.cssText = 'margin-left:4px;padding:2px 6px;font-size:10px;cursor:pointer;';
        btn.addEventListener('click', () => {
          state.wordGuessedThisRound = false;
          refreshCandidates('force-show');
          devLog('info', 'Show words (recover) triggered');
        });
        wrap.appendChild(btn);
        state.ui.candidateTop.innerHTML = '';
        state.ui.candidateTop.appendChild(wrap);
      }
    }

    function filterCandidates(query) {
      if (!query.trim()) {
        return state.candidates.filter(w => !state.sentThisRound.has(normalizeWord(w))).slice(0, LIMITS.candidatePreview);
      }
      const q = query.toLowerCase();
      return state.candidates.filter(word => {
        const normalized = normalizeWord(word);
        return word.toLowerCase().includes(q) && !state.sentThisRound.has(normalized);
      }).slice(0, LIMITS.candidatePreview);
    }

    function measureWidestCharWidthPx() {
      const panel = state.ui?.panel;
      const fontFamily = (panel && getComputedStyle(panel).fontFamily) ? getComputedStyle(panel).fontFamily : 'Arial,sans-serif';
      let span = document.getElementById('sag-measure-span');
      if (!span) {
        span = document.createElement('span');
        span.id = 'sag-measure-span';
        span.setAttribute('aria-hidden', 'true');
        span.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;font:12px/1.35 Arial,sans-serif';
        document.body.appendChild(span);
      }
      span.style.font = fontFamily;
      span.style.fontSize = '100px';
      span.textContent = 'm';
      return span.offsetWidth / 100;
    }

    function renderTopCandidates(filteredCandidates = null, keepSearchActive = false) {
      state.renderTopCandidatesPending = [filteredCandidates, keepSearchActive];
      if (state.renderTopCandidatesRaf != null) return;
      state.renderTopCandidatesRaf = requestAnimationFrame(() => {
        state.renderTopCandidatesRaf = null;
        const pending = state.renderTopCandidatesPending;
        state.renderTopCandidatesPending = null;
        if (pending) renderTopCandidatesImmediate(pending[0], pending[1]);
      });
    }

    function renderTopCandidatesImmediate(filteredCandidates, keepSearchActive) {
      if (!state.ui?.candidateTop) return;
      // Never re-render the word list while the bot is stopped — that would
      // overwrite the "stopped" or "word guessed" placeholder with a fresh
      // candidate grid every time the hint observer fires.
      if (!state.running) return;
      if (state.wordGuessedThisRound) {
        hideCandidates();
        return;
      }

      const candidates = filteredCandidates || filterCandidates('');
      if (!candidates.length) {
        state.ui.candidateTop.innerHTML = '<div style="padding:8px;text-align:center;color:#999;font-size:10px;">No matches</div>';
        return;
      }
  
      const existingContainer = state.ui.candidateTop.querySelector('div');
      const savedScrollTop = existingContainer ? existingContainer.scrollTop : 0;
      
      state.ui.candidateTop.innerHTML = '';
      const container = document.createElement('div');
      container.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:6px;height:186px;overflow-y:scroll;padding:6px;border:1px solid #e5e7eb;border-radius:4px;align-content:start;width:100%;box-sizing:border-box;';
      
      container.addEventListener('scroll', () => {
        state.isUserScrolling = true;
        clearTimeout(container.scrollTimeout);
        container.scrollTimeout = setTimeout(() => {
          state.isUserScrolling = false;
        }, 500);
      });
      
      const paddingPx = 14;
      const minFontPx = 9;
      const maxFontPx = 18;
      const wrapThreshold = 14;

      candidates.forEach((word, index) => {
        const wordLength = Math.max(1, word.length);
        const allowWrap = wordLength > wrapThreshold;
        const padding = wordLength >= 16 ? '10px' : '8px';
        const minHeight = allowWrap ? '48px' : (wordLength >= 16 ? '48px' : (wordLength >= 12 ? '40px' : '36px'));

        const box = document.createElement('button');
        box.type = 'button';
        const wrapStyle = allowWrap ? 'white-space:normal;word-break:break-word;overflow:hidden;' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        box.style.cssText = `padding:${padding};font-size:${minFontPx}px;border:1px solid #cbd5e1;border-radius:3px;background:#f8fafc;cursor:pointer;${wrapStyle}text-align:center;line-height:1.2;color:#111827;font-weight:500;min-height:${minHeight};`;
        box.textContent = word;
        box.title = `${index + 1}. ${word}`;
        box.dataset.wordLength = String(wordLength);
        box.dataset.allowWrap = allowWrap ? '1' : '0';

        box.addEventListener('mouseenter', () => {
          box.style.background = '#e5e7eb';
        });
        box.addEventListener('mouseleave', () => {
          box.style.background = '#f8fafc';
        });
        
        box.addEventListener('click', () => {
          sendGuess(word);
          state.sentThisRound.add(normalizeWord(word));
          // Reset the automation timer so the next auto-send is exactly one delay after
          // this click — prevents both immediate double-fires and overly long gaps.
          if (state.running) {
            if (state.loopTimer) {
              clearTimeout(state.loopTimer);
              state.loopTimer = null;
            }
            scheduleNextTick(getConfiguredDelay());
          }
          if (!keepSearchActive) {
            renderTopCandidates();
          }
        });
        
        container.appendChild(box);
      });
      
      state.ui.candidateTop.appendChild(container);
      container.scrollTop = savedScrollTop;

      function fitWordFontSizes() {
        const firstCell = container.querySelector('button');
        const cellWidth = firstCell ? firstCell.offsetWidth : 100;
        const rawAvailable = Math.max(28, cellWidth - paddingPx);
        const availableWidth = rawAvailable * 0.94;
        const pxPerChar = measureWidestCharWidthPx();
        container.querySelectorAll('button').forEach((box) => {
          const L = parseInt(box.dataset.wordLength, 10) || 1;
          const allowWrap = box.dataset.allowWrap === '1';
          let maxFont;
          if (allowWrap) {
            const charsPerLine = Math.max(1, Math.floor(L / 2));
            maxFont = pxPerChar > 0 ? Math.floor(availableWidth / (charsPerLine * pxPerChar)) : maxFontPx;
          } else {
            maxFont = pxPerChar > 0 ? Math.floor(availableWidth / (L * pxPerChar)) : maxFontPx;
          }
          const fontSize = Math.max(minFontPx, Math.min(maxFontPx, maxFont));
          box.style.fontSize = `${fontSize}px`;
        });
      }
      fitWordFontSizes();

      function runFitAfterLayout() {
        requestAnimationFrame(() => requestAnimationFrame(fitWordFontSizes));
      }

      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => runFitAfterLayout());
        ro.observe(container);
      }
    }

    function attachObservers() {
      if (state.observers.hint) state.observers.hint.disconnect();
      if (state.observers.chat) state.observers.chat.disconnect();
      if (state.observers.round) state.observers.round.disconnect();
  
      if (state.selectors.hint) {
        state.observers.hint = new MutationObserver(() => refreshCandidates('hint mutation'));
        state.observers.hint.observe(state.selectors.hint, { childList: true, subtree: true, characterData: true });
      }
  
      if (state.selectors.chat) {
        state.observers.chat = new MutationObserver(() => {
          const text = state.selectors.chat.textContent || '';
          parseChatSignals(text);
        });
        state.observers.chat.observe(state.selectors.chat, { childList: true, subtree: true, characterData: true });
      }
  
      if (state.selectors.roundRoot) {
        state.observers.round = new MutationObserver(() => {
          const roundText = (document.querySelector('.round')?.textContent || '').trim();
          const phase = getGamePhase();
          const token = `${roundText}::${phase}`;
          
          if (state.roundToken && token !== state.roundToken && /between-words|between-rounds|choosing/.test(phase)) {
            startNewRound();
          }
          
          if (!state.roundToken || token !== state.roundToken) {
            if (/guessing|playing/.test(phase)) {
              refreshCandidates('round-phase-change-guessing');
            }
          }
          
          state.roundToken = token;
        });
        state.observers.round.observe(state.selectors.roundRoot, { childList: true, subtree: true });
      }
    }
  
    function devLog(category, message) {
      const ts = new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const entry = { ts, category, message: String(message) };
      state.devLog.push(entry);
      if (state.devLog.length > LIMITS.devLogMax) state.devLog.shift();
      if (state.ui?.devLogEl) {
        const line = document.createElement('div');
        line.style.cssText = 'border-bottom:1px solid #f0f0f0;padding:2px 0;line-height:1.4;';
        const catColors = { hint: '#7c3aed', chat: '#0284c7', guess: '#16a34a', round: '#d97706', error: '#dc2626', info: '#6b7280' };
        const color = catColors[category] || '#6b7280';
        line.innerHTML = `<span style="color:#9ca3af;font-size:9px;">${ts}</span> <span style="color:${color};font-weight:700;font-size:9px;">[${category}]</span> <span style="font-size:10px;">${entry.message}</span>`;
        state.ui.devLogEl.appendChild(line);
        state.ui.devLogEl.scrollTop = state.ui.devLogEl.scrollHeight;
      }
    }

    function renderDebug(context) {
      if (!state.ui) return;
      state.ui.hintRaw.textContent = state.currentHintRaw || '-';
      state.ui.hintNormalized.textContent = state.currentUnderscorePattern || '-';
      state.ui.letterPattern.textContent = state.currentLetterPattern || '-';
      state.ui.wordCount.textContent = String(state.wordCount || state.words.length || 0);
      state.ui.candidateCount.textContent = String(state.candidates.length);
      state.ui.mode.textContent = state.running ? 'running' : 'stopped';
      state.ui.phase.textContent = state.lastGamePhase || 'unknown';
      state.ui.closeState.textContent = state.closeHitPending ? `pending: ${state.closeHitPending}` : 'none';
      state.ui.cooldown.textContent = state.cooldownRemainingMs > 0 ? `${Math.ceil(state.cooldownRemainingMs / 1000)}s` : '0s';
      state.ui.context.textContent = context;
      // Compact hint bar: "_t____ (1t5)"
      if (state.ui.hintCompact) {
        const raw = state.currentHintRaw || '';
        const pat = state.currentLetterPattern || '';
        state.ui.hintCompact.textContent = raw ? `${raw}${pat ? ` (${pat})` : ''}` : '-';
      }
      if (state.ui.devNickname) {
        // Always do a fresh DOM scan so the dev panel shows the live detected value
        const savedCache = state.selfName;
        state.selfName = '';
        const name = getSelfName() || '(not detected)';
        if (!name || name === '(not detected)') state.selfName = savedCache;
        state.ui.devNickname.textContent = name;
      }
    }
  
    // options: { xKey, yKey } — which settings keys to save position into
    function makeDraggable(panel, handle, onDragCallback, options) {
      options = options || {};
      const xKey = options.xKey || 'panelX';
      const yKey = options.yKey || 'panelY';
      let dragging = false;
      let startX = 0;
      let startY = 0;

      const onMove = (e) => {
        if (!dragging) return;
        const x = e.clientX - startX;
        const y = e.clientY - startY;
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        const maxX = Math.max(0, window.innerWidth - panelWidth);
        const maxY = Math.max(0, window.innerHeight - panelHeight);
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        panel.style.left = `${constrainedX}px`;
        panel.style.top = `${constrainedY}px`;
        panel.style.right = 'auto';
        settings[xKey] = constrainedX;
        settings[yKey] = constrainedY;
        saveSettings();
        if (onDragCallback) onDragCallback(constrainedX, constrainedY);
      };

      const onUp = () => {
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      handle.addEventListener('mousedown', (e) => {
        // Don't initiate drag when clicking buttons/inputs inside the header
        if (e.target !== handle && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        e.preventDefault();
      });
    }

    // Supports all 8 resize directions: n, s, e, w, ne, nw, se, sw.
    // North/west drags move the panel's top/left while adjusting size, so the
    // opposite edge stays anchored — just like a native window resize.
    function makeResizable(panel, handles, onResize, options) {
      options = options || {};
      const sizeLimits = options.limits || PANEL_SIZE;
      const widthKey = options.widthKey || 'panelWidth';
      const heightKey = options.heightKey || 'panelHeight';
      const xKey = options.xKey || 'panelX';
      const yKey = options.yKey || 'panelY';

      let resizing = false;
      let dir = 'se';
      let startX = 0, startY = 0;
      let startW = 0, startH = 0, startLeft = 0, startTop = 0;

      function startResize(e, d) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        dir = d;
        startX = e.clientX;
        startY = e.clientY;
        startW = panel.offsetWidth;
        startH = panel.offsetHeight;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }

      function onMove(e) {
        if (!resizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const maxH = Math.min(sizeLimits.maxHeight || 1200, window.innerHeight * 0.95);
        const minW = sizeLimits.minWidth;
        const maxW = sizeLimits.maxWidth || 9999;
        const minH = sizeLimits.minHeight;

        let w = startW, h = startH, left = startLeft, top = startTop;

        // East / West
        if (dir === 'e' || dir === 'se' || dir === 'ne') {
          w = Math.max(minW, Math.min(maxW, startW + dx));
        }
        if (dir === 'w' || dir === 'sw' || dir === 'nw') {
          w = Math.max(minW, Math.min(maxW, startW - dx));
          // Move left edge; clamp so panel stays on screen
          left = startLeft + (startW - w);
        }

        // South / North
        if (dir === 's' || dir === 'se' || dir === 'sw') {
          h = Math.max(minH, Math.min(maxH, startH + dy));
        }
        if (dir === 'n' || dir === 'ne' || dir === 'nw') {
          h = Math.max(minH, Math.min(maxH, startH - dy));
          top = startTop + (startH - h);
        }

        panel.style.width = `${w}px`;
        panel.style.height = `${h}px`;
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        panel.style.right = 'auto';
        if (onResize) onResize(w, h);
      }

      function onUp() {
        if (!resizing) return;
        resizing = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        settings[widthKey] = panel.offsetWidth;
        settings[heightKey] = panel.offsetHeight;
        // Save position in case a north/west drag moved the panel
        const rect = panel.getBoundingClientRect();
        settings[xKey] = rect.left;
        settings[yKey] = rect.top;
        saveSettings();
      }

      if (Array.isArray(handles)) {
        handles.forEach(({ el, dir: d }) => el && el.addEventListener('mousedown', (e) => startResize(e, d)));
      } else if (handles) {
        handles.addEventListener('mousedown', (e) => startResize(e, 'se'));
      }
    }

    function ensurePanelVisible(panel) {
      const panelWidth = panel.offsetWidth || 320;
      const panelHeight = panel.offsetHeight || 400;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let x = settings.panelX != null ? settings.panelX : 0;
      let y = settings.panelY != null ? settings.panelY : 0;
      
      if (x + panelWidth > viewportWidth) {
        x = Math.max(0, viewportWidth - panelWidth - 10);
      }
      if (y + panelHeight > viewportHeight) {
        y = Math.max(0, viewportHeight - panelHeight - 10);
      }
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.right = 'auto';
      settings.panelX = x;
      settings.panelY = y;
      saveSettings();
    }
  
    function createPanel() {
      const panel = document.createElement('div');
      panel.id = 'skribbl-auto-guesser-panel';
      const w = Math.max(PANEL_SIZE.minWidth, Math.min(PANEL_SIZE.maxWidth, settings.panelWidth || 320));
      const collapsedHeight = 44;
      const h = settings.collapsed
        ? collapsedHeight
        : (settings.panelHeight != null
            ? Math.max(PANEL_SIZE.minHeight, Math.min(PANEL_SIZE.maxHeight || 1200, settings.panelHeight))
            : 'auto');
      panel.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'background:#fff',
        'border:1px solid #d0d7de',
        'border-radius:10px',
        'box-shadow:0 8px 24px rgba(15,23,42,.18)',
        'color:#1f2937',
        'font:12px/1.35 Arial,sans-serif',
        `width:${w}px`,
        'min-width:' + PANEL_SIZE.minWidth + 'px',
        'max-height:90vh',
        'overflow:hidden',
        'padding:8px',
        'box-sizing:border-box',
        'display:flex',
        'flex-direction:column',
        settings.panelX != null && settings.panelY != null
          ? `left:${settings.panelX}px;top:${settings.panelY}px`
          : 'top:12px;right:12px',
      ].join(';');
      if (h !== 'auto') {
        panel.style.height = h + 'px';
        if (settings.collapsed) panel.style.minHeight = collapsedHeight + 'px';
      }
  
      const style = document.createElement('style');
      style.textContent = `
        #skribbl-auto-guesser-panel {
          color: #111827 !important;
        }
        #skribbl-auto-guesser-panel #sag-body {
          flex: 1;
          min-height: 0;
          overflow: auto;
        }
        #skribbl-auto-guesser-panel .sag-resize-edge {
          pointer-events: auto;
        }
        #skribbl-auto-guesser-panel .sag-resize-edge:hover {
          background: rgba(59, 130, 246, 0.15);
        }
        #skribbl-auto-guesser-panel #sag-search-section {
          width: 100%;
          min-width: 0;
        }
        #skribbl-auto-guesser-panel #sag-candidate-top {
          display: block;
          width: 100%;
          min-width: 0;
        }
        #skribbl-auto-guesser-panel strong,
        #skribbl-auto-guesser-panel span,
        #skribbl-auto-guesser-panel label {
          color: #111827 !important;
        }
        #skribbl-auto-guesser-panel input[type="text"],
        #skribbl-auto-guesser-panel input[type="number"] {
          color: #111827 !important;
          background: #ffffff !important;
          border: 1px solid #94a3b8 !important;
        }
        /* Hide real checkbox; custom box is in .sag-dot-box so page styles can't override */
        #skribbl-auto-guesser-panel #sag-dot {
          position: absolute !important;
          width: 1px !important;
          height: 1px !important;
          margin: -1px !important;
          padding: 0 !important;
          overflow: hidden !important;
          clip: rect(0,0,0,0) !important;
          border: 0 none !important;
          appearance: none !important;
          -webkit-appearance: none !important;
        }
        #skribbl-auto-guesser-panel .sag-dot-box {
          display: inline-block !important;
          width: 16px !important;
          height: 16px !important;
          flex-shrink: 0 !important;
          border: 2px solid #94a3b8 !important;
          border-radius: 3px !important;
          background-color: #fff !important;
          background-image: none !important;
          box-sizing: border-box !important;
          vertical-align: middle !important;
        }
        #skribbl-auto-guesser-panel #sag-dot:checked + .sag-dot-box {
          background-color: #2563eb !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' d='M2 8l4 4 8-8'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          background-size: 12px !important;
          border-color: #2563eb !important;
        }
        #skribbl-auto-guesser-panel button {
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-weight: 700 !important;
          line-height: 1.1 !important;
          cursor: pointer !important;
          color: #111827 !important;
          background: #f8fafc !important;
        }
        #skribbl-auto-guesser-panel #sag-start {
          background: #2563eb !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }
        #skribbl-auto-guesser-panel #sag-stop {
          background: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
        }
        #skribbl-auto-guesser-panel #sag-refresh {
          background: #f8fafc !important;
          color: #111827 !important;
        }
        #skribbl-auto-guesser-panel #sag-add-word {
          background: #16a34a !important;
          color: #ffffff !important;
          border-color: #15803d !important;
        }
        #skribbl-auto-guesser-panel #sag-remove-word {
          background: #f97316 !important;
          color: #ffffff !important;
          border-color: #ea580c !important;
        }
        #skribbl-auto-guesser-panel #sag-dedupe {
          background: #0ea5e9 !important;
          color: #ffffff !important;
          border-color: #0284c7 !important;
        }
        #skribbl-auto-guesser-panel #sag-dev-toggle {
          background: #6d28d9 !important;
          color: #ffffff !important;
          border-color: #5b21b6 !important;
        }
        #skribbl-auto-guesser-panel #sag-refresh-rate {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 22px;
        }
        #skribbl-auto-guesser-panel #sag-refresh-rate::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
        }
        #skribbl-auto-guesser-panel #sag-refresh-rate::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2563eb;
          margin-top: -6px;
          cursor: pointer;
        }
        #skribbl-auto-guesser-panel #sag-refresh-rate::-moz-range-track {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
        }
        #skribbl-auto-guesser-panel #sag-refresh-rate::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #2563eb;
          border: none;
          cursor: pointer;
        }
        #skribbl-auto-guesser-panel #sag-closehit-scan {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 22px;
        }
        #skribbl-auto-guesser-panel #sag-closehit-scan::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
        }
        #skribbl-auto-guesser-panel #sag-closehit-scan::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #16a34a;
          margin-top: -6px;
          cursor: pointer;
        }
        #skribbl-auto-guesser-panel #sag-closehit-scan::-moz-range-track {
          width: 100%;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
        }
        #skribbl-auto-guesser-panel #sag-closehit-scan::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #16a34a;
          border: none;
          cursor: pointer;
        }
        #skribbl-auto-guesser-dev-panel {
          color: #111827 !important;
        }
        #skribbl-auto-guesser-dev-panel button {
          border: 1px solid #cbd5e1 !important;
          border-radius: 6px !important;
          font-weight: 700 !important;
          cursor: pointer !important;
          color: #111827 !important;
          background: #f8fafc !important;
        }
        #skribbl-auto-guesser-dev-panel #sag-dev-force-hide {
          background: #dc2626 !important;
          color: #ffffff !important;
          border-color: #b91c1c !important;
        }
        #skribbl-auto-guesser-dev-panel #sag-dev-force-show {
          background: #16a34a !important;
          color: #ffffff !important;
          border-color: #15803d !important;
        }
        #skribbl-auto-guesser-dev-panel #sag-dev-snap {
          background: #0ea5e9 !important;
          color: #ffffff !important;
          border-color: #0284c7 !important;
        }
        #skribbl-auto-guesser-dev-panel #sag-dev-new-round {
          background: #d97706 !important;
          color: #ffffff !important;
          border-color: #b45309 !important;
        }
        #skribbl-auto-guesser-dev-panel .sag-resize-edge:hover {
          background: rgba(59, 130, 246, 0.15);
        }
  
        #skribbl-auto-guesser-panel .sag-candidate-chip {
          display: inline-block;
          margin: 2px 4px 2px 0;
          padding: 2px 6px;
          border: 1px solid #93c5fd;
          border-radius: 10px;
          background: #eff6ff;
          color: #1e40af;
          font-size: 11px;
          cursor: pointer;
        }
        #skribbl-auto-guesser-panel .sag-candidate-chip.copied {
          background: #16a34a !important;
          border-color: #15803d !important;
          color: #ffffff !important;
        }
        #skribbl-auto-guesser-panel #sag-search-input {
          width: 100%;
          padding: 6px 8px;
          font-size: 12px;
          margin-bottom: 6px;
          border: 1px solid #d0d7de !important;
          border-radius: 4px;
        }
        #skribbl-auto-guesser-panel #sag-search-hint {
          font-size: 10px;
          color: #666;
          margin-bottom: 4px;
        }
        #skribbl-auto-guesser-panel .sag-word-row {
          padding: 6px;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: background 0.2s;
        }
        #skribbl-auto-guesser-panel .sag-word-row:hover {
          background: #f9fafb;
        }
        #skribbl-auto-guesser-panel .sag-word-copy {
          padding: 2px 6px !important;
          font-size: 10px !important;
          background: #f0f0f0 !important;
        }
      `;
      document.head.appendChild(style);
  
      panel.innerHTML = `
        <div id="sag-header" style="display:flex;align-items:center;justify-content:space-between;cursor:move;gap:8px;margin-bottom:6px;">
          <strong>Skribbl Auto Guesser <span style="font-weight:400;font-size:11px;color:#6b7280;">${SCRIPT_VERSION}</span></strong>
          <button id="sag-collapse" style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;padding:2px 6px;cursor:pointer;">${settings.collapsed ? '+' : '-'}</button>
        </div>
        <div id="sag-body" style="display:${settings.collapsed ? 'none' : 'block'};">
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
            <button id="sag-start" style="padding:5px 10px;">Start</button>
            <button id="sag-stop" style="padding:5px 10px;">Stop</button>
            <button id="sag-refresh" style="padding:5px 10px;">Refresh parse</button>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:4px;font-size:11px;">
              Delay (ms)
              <input id="sag-delay-input" type="number" min="0" max="8000" step="50" value="${settings.delayMs}" style="width:64px;padding:2px 4px;font-size:11px;border:1px solid #cbd5e1;border-radius:4px;" />
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input id="sag-dot" type="checkbox" ${settings.dotPrefix ? 'checked' : ''} />
              <span class="sag-dot-box"></span>
              Dot prefix
            </label>
          </div>

          <!-- Compact hint bar -->
          <div style="font-size:11px;padding:4px 8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;margin-bottom:6px;font-family:monospace;letter-spacing:0.5px;">
            Hint: <span id="sag-hint-compact" style="font-weight:700;color:#0369a1;">-</span>
          </div>

          <div id="sag-search-section" style="margin-bottom:6px;">
            <input id="sag-search-input" type="text" placeholder="Search words (type 1-9 or Enter to send)" />
            <div id="sag-search-hint" style="display:none;">Press 1-9 for first 9 results, Enter for first result</div>
            <span id="sag-candidate-top">-</span>
          </div>

          <!-- Details toggle -->
          <button id="sag-details-toggle" style="width:100%;padding:3px;font-size:10px;margin-bottom:4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;text-align:center;">${settings.detailsCollapsed ? 'Show details v' : 'Hide details ^'}</button>

          <div id="sag-details" style="display:${settings.detailsCollapsed ? 'none' : 'block'};">
            <div style="font-size:11px;display:grid;grid-template-columns:110px 1fr;gap:3px 6px;word-break:break-word;margin-bottom:6px;">
              <span>Status</span><span id="sag-status">Idle</span>
              <span>Raw hint</span><span id="sag-hint-raw">-</span>
              <span>Underscore</span><span id="sag-hint-normalized">-</span>
              <span>Letter pattern</span><span id="sag-letter-pattern">-</span>
              <span>Word list size</span><span id="sag-word-count">0</span>
              <span>Candidates</span><span id="sag-candidate-count">0</span>
              <span>Last guess</span><span id="sag-last-guess">-</span>
              <span>Mode</span><span id="sag-mode">stopped</span>
              <span>Game phase</span><span id="sag-phase">unknown</span>
              <span>Close-hit</span><span id="sag-close">none</span>
              <span>Spam cooldown</span><span id="sag-cooldown">0s</span>
              <span>Context</span><span id="sag-context">init</span>
            </div>

            <!-- Add/Remove word (moved here) -->
            <div style="display:flex;gap:4px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
              <input id="sag-word-input" type="text" placeholder="word" style="flex:1;min-width:80px;padding:3px 5px;" />
              <button id="sag-add-word" style="padding:4px 8px;">Add</button>
              <button id="sag-remove-word" style="padding:4px 8px;">Remove</button>
              <button id="sag-dedupe" style="padding:4px 8px;">Dedupe</button>
            </div>

            <!-- Refresh rate slider: controls how fast the bot polls for hint/chat changes -->
            <div style="margin-bottom:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                <span>Bot refresh rate:</span>
                <strong id="sag-refresh-rate-val">${settings.refreshRateMs ?? DEFAULT_SETTINGS.refreshRateMs}ms</strong>
              </div>
              <div class="sag-range-wrap" style="width:100%;box-sizing:border-box;display:flex;justify-content:center;">
                <input id="sag-refresh-rate" class="sag-range" type="range" min="50" max="2000" step="50" value="${settings.refreshRateMs ?? DEFAULT_SETTINGS.refreshRateMs}" style="width:calc(100% - 32px);max-width:100%;cursor:pointer;display:block;box-sizing:content-box;" />
              </div>
              <div style="display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;margin-top:2px;">
                <span>Fast (50ms)</span><span>Slow (2000ms)</span>
              </div>
            </div>

            <!-- Close-hit scan slider: how fast the watcher polls for ".word is close!" after a dot-send -->
            <div style="margin-bottom:6px;">
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-bottom:2px;">
                <span>Close-hit scan rate:</span>
                <strong id="sag-closehit-scan-val">${settings.closeHitScanMs ?? DEFAULT_SETTINGS.closeHitScanMs}ms</strong>
              </div>
              <div class="sag-range-wrap" style="width:100%;box-sizing:border-box;display:flex;justify-content:center;">
                <input id="sag-closehit-scan" class="sag-range" type="range" min="10" max="200" step="10" value="${settings.closeHitScanMs ?? DEFAULT_SETTINGS.closeHitScanMs}" style="width:calc(100% - 32px);max-width:100%;cursor:pointer;display:block;box-sizing:content-box;" />
              </div>
              <div style="display:flex;justify-content:space-between;font-size:9px;color:#9ca3af;margin-top:2px;">
                <span>Fast (10ms)</span><span>Slow (200ms)</span>
              </div>
            </div>

            <!-- Dev Panel toggle -->
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <strong style="font-size:11px;">Developer Panel</strong>
              <button id="sag-dev-toggle" style="padding:2px 8px;font-size:10px;">Show</button>
            </div>
          </div>
          <!-- Resize edges: all 8 directions -->
          <div id="sag-resize-n"  class="sag-resize-edge" style="position:absolute;top:0;left:8px;right:8px;height:6px;cursor:ns-resize;z-index:10;"></div>
          <div id="sag-resize-s"  class="sag-resize-edge" style="position:absolute;bottom:0;left:8px;right:8px;height:6px;cursor:ns-resize;z-index:10;"></div>
          <div id="sag-resize-e"  class="sag-resize-edge" style="position:absolute;top:8px;right:0;bottom:8px;width:6px;cursor:ew-resize;z-index:10;"></div>
          <div id="sag-resize-w"  class="sag-resize-edge" style="position:absolute;top:8px;left:0;bottom:8px;width:6px;cursor:ew-resize;z-index:10;"></div>
          <div id="sag-resize-nw" class="sag-resize-edge" style="position:absolute;top:0;left:0;width:12px;height:12px;cursor:nwse-resize;z-index:11;"></div>
          <div id="sag-resize-ne" class="sag-resize-edge" style="position:absolute;top:0;right:0;width:12px;height:12px;cursor:nesw-resize;z-index:11;"></div>
          <div id="sag-resize-sw" class="sag-resize-edge" style="position:absolute;bottom:0;left:0;width:12px;height:12px;cursor:nesw-resize;z-index:11;"></div>
          <div id="sag-resize-se" class="sag-resize-edge" style="position:absolute;bottom:0;right:0;width:12px;height:12px;cursor:nwse-resize;z-index:11;"></div>
        </div>
      `;
  
      // --- Side developer panel (separate floating div, resizable) ---
      const devPanel = document.createElement('div');
      devPanel.id = 'skribbl-auto-guesser-dev-panel';
      const devW = Math.max(DEV_PANEL_SIZE.minWidth, Math.min(DEV_PANEL_SIZE.maxWidth, settings.devPanelWidth || 300));
      const devH = Math.max(DEV_PANEL_SIZE.minHeight, Math.min(DEV_PANEL_SIZE.maxHeight || 1200, settings.devPanelHeight || 420));
      devPanel.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'background:#fff',
        'border:1px solid #d0d7de',
        'border-radius:10px',
        'box-shadow:0 8px 24px rgba(15,23,42,.18)',
        'color:#1f2937',
        'font:12px/1.35 Arial,sans-serif',
        `width:${devW}px`,
        `height:${devH}px`,
        'min-width:' + DEV_PANEL_SIZE.minWidth + 'px',
        'overflow:hidden',
        'padding:8px',
        'box-sizing:border-box',
        'display:none',
        'flex-direction:column',
        'flex',
      ].join(';');

      devPanel.innerHTML = `
        <div id="sag-dev-content" style="flex:1;min-height:0;overflow:auto;">
          <div id="sag-dev-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:move;user-select:none;">
            <strong style="font-size:12px;">🛠 Developer Panel</strong>
            <button id="sag-dev-close" style="padding:2px 7px;font-size:11px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:5px;cursor:pointer;">✕</button>
          </div>
          <div style="font-size:11px;margin-bottom:6px;padding:4px 6px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:4px;">
            Your nickname: <strong id="sag-dev-nickname" style="color:#2563eb;">(not detected)</strong>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
            <button id="sag-dev-snap" style="padding:3px 8px;font-size:10px;">Snapshot state</button>
            <button id="sag-dev-force-hide" style="padding:3px 8px;font-size:10px;">Force hide words</button>
            <button id="sag-dev-force-show" style="padding:3px 8px;font-size:10px;">Force show words</button>
            <button id="sag-dev-clear-sent" style="padding:3px 8px;font-size:10px;">Clear sent set</button>
            <button id="sag-dev-new-round" style="padding:3px 8px;font-size:10px;">Simulate new round</button>
            <button id="sag-dev-clear-log" style="padding:3px 8px;font-size:10px;">Clear log</button>
            <button id="sag-dev-copy-log" style="padding:3px 8px;font-size:10px;">Copy log</button>
          </div>
          <div id="sag-dev-snap-out" style="display:none;font-size:9px;font-family:monospace;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;padding:6px;margin-bottom:6px;max-height:80px;overflow-y:auto;word-break:break-all;white-space:pre-wrap;"></div>
          <div style="font-size:10px;font-weight:700;color:#374151;margin-bottom:3px;">Bot log</div>
          <div id="sag-dev-log" style="height:280px;overflow-y:auto;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:4px 6px;font-family:monospace;"></div>
        </div>
        <div id="sag-dev-resize-n"  class="sag-resize-edge" style="position:absolute;top:0;left:8px;right:8px;height:6px;cursor:ns-resize;z-index:10;"></div>
        <div id="sag-dev-resize-s"  class="sag-resize-edge" style="position:absolute;bottom:0;left:8px;right:8px;height:6px;cursor:ns-resize;z-index:10;"></div>
        <div id="sag-dev-resize-e"  class="sag-resize-edge" style="position:absolute;top:8px;right:0;bottom:8px;width:6px;cursor:ew-resize;z-index:10;"></div>
        <div id="sag-dev-resize-w"  class="sag-resize-edge" style="position:absolute;top:8px;left:0;bottom:8px;width:6px;cursor:ew-resize;z-index:10;"></div>
        <div id="sag-dev-resize-nw" class="sag-resize-edge" style="position:absolute;top:0;left:0;width:12px;height:12px;cursor:nwse-resize;z-index:11;"></div>
        <div id="sag-dev-resize-ne" class="sag-resize-edge" style="position:absolute;top:0;right:0;width:12px;height:12px;cursor:nesw-resize;z-index:11;"></div>
        <div id="sag-dev-resize-sw" class="sag-resize-edge" style="position:absolute;bottom:0;left:0;width:12px;height:12px;cursor:nesw-resize;z-index:11;"></div>
        <div id="sag-dev-resize-se" class="sag-resize-edge" style="position:absolute;bottom:0;right:0;width:12px;height:12px;cursor:nwse-resize;z-index:11;"></div>
      `;
      document.body.appendChild(devPanel);

      // Position dev panel: use saved position if the user moved it, otherwise auto-place
      // beside the main panel. Called once on open and never after (dev panel is freely draggable).
      function repositionDevPanel() {
        if (settings.devPanelX != null && settings.devPanelY != null) {
          // Clamp to viewport in case the window was resized since last session
          const dw = devPanel.offsetWidth || devW;
          const dh = devPanel.offsetHeight || devH;
          const x = Math.max(0, Math.min(settings.devPanelX, window.innerWidth - dw));
          const y = Math.max(0, Math.min(settings.devPanelY, window.innerHeight - dh));
          devPanel.style.left = `${x}px`;
          devPanel.style.top = `${y}px`;
          devPanel.style.right = 'auto';
          return;
        }
        // No saved position — auto-place to the right (or left) of the main panel
        const mainRect = panel.getBoundingClientRect();
        const gap = 8;
        const dw = devPanel.offsetWidth || devW;
        let left = mainRect.right + gap;
        if (left + dw > window.innerWidth) {
          left = Math.max(0, mainRect.left - dw - gap);
        }
        const top = Math.min(mainRect.top, window.innerHeight - devPanel.offsetHeight - 10);
        devPanel.style.left = `${left}px`;
        devPanel.style.top = `${Math.max(0, top)}px`;
        devPanel.style.right = 'auto';
      }

      // Dev panel resize (same edge/corner behavior as main panel)
      // Dev panel: all-sides resize
      makeResizable(devPanel, [
        { el: devPanel.querySelector('#sag-dev-resize-n'),  dir: 'n' },
        { el: devPanel.querySelector('#sag-dev-resize-s'),  dir: 's' },
        { el: devPanel.querySelector('#sag-dev-resize-e'),  dir: 'e' },
        { el: devPanel.querySelector('#sag-dev-resize-w'),  dir: 'w' },
        { el: devPanel.querySelector('#sag-dev-resize-nw'), dir: 'nw' },
        { el: devPanel.querySelector('#sag-dev-resize-ne'), dir: 'ne' },
        { el: devPanel.querySelector('#sag-dev-resize-sw'), dir: 'sw' },
        { el: devPanel.querySelector('#sag-dev-resize-se'), dir: 'se' },
      ], null, {
        limits: DEV_PANEL_SIZE,
        widthKey: 'devPanelWidth',
        heightKey: 'devPanelHeight',
        xKey: 'devPanelX',
        yKey: 'devPanelY',
      });

      // Dev panel: draggable by its title bar
      const devHeader = devPanel.querySelector('#sag-dev-header');
      makeDraggable(devPanel, devHeader, null, { xKey: 'devPanelX', yKey: 'devPanelY' });

      document.body.appendChild(panel);
      ensurePanelVisible(panel);
  
      const header = panel.querySelector('#sag-header');
      makeDraggable(panel, header);
      // Main panel: all-sides resize
      makeResizable(panel, [
        { el: panel.querySelector('#sag-resize-n'),  dir: 'n' },
        { el: panel.querySelector('#sag-resize-s'),  dir: 's' },
        { el: panel.querySelector('#sag-resize-e'),  dir: 'e' },
        { el: panel.querySelector('#sag-resize-w'),  dir: 'w' },
        { el: panel.querySelector('#sag-resize-nw'), dir: 'nw' },
        { el: panel.querySelector('#sag-resize-ne'), dir: 'ne' },
        { el: panel.querySelector('#sag-resize-sw'), dir: 'sw' },
        { el: panel.querySelector('#sag-resize-se'), dir: 'se' },
      ]);
  
      const body = panel.querySelector('#sag-body');
      const collapse = panel.querySelector('#sag-collapse');
      const dotToggle = panel.querySelector('#sag-dot');
      const wordInput = panel.querySelector('#sag-word-input');

      const COLLAPSED_PANEL_HEIGHT = 44;
      collapse.addEventListener('click', () => {
        settings.collapsed = !settings.collapsed;
        body.style.display = settings.collapsed ? 'none' : 'block';
        collapse.textContent = settings.collapsed ? '+' : '-';
        if (settings.collapsed) {
          panel.style.height = COLLAPSED_PANEL_HEIGHT + 'px';
          panel.style.minHeight = COLLAPSED_PANEL_HEIGHT + 'px';
        } else {
          const restored = Math.max(PANEL_SIZE.minHeight, Math.min(PANEL_SIZE.maxHeight || 1200, settings.panelHeight || 400));
          panel.style.height = restored + 'px';
          panel.style.minHeight = PANEL_SIZE.minHeight + 'px';
          settings.panelHeight = restored;
          saveSettings();
        }
        saveSettings();
      });

      // Details collapse toggle — resize panel to fit content when toggling
      const detailsToggle = panel.querySelector('#sag-details-toggle');
      const detailsEl = panel.querySelector('#sag-details');
      function fitPanelHeightToContent() {
        requestAnimationFrame(() => {
          const prevHeight = panel.style.height;
          const prevMaxHeight = panel.style.maxHeight;
          panel.style.height = 'auto';
          panel.style.maxHeight = 'none';
          const contentHeight = panel.getBoundingClientRect().height;
          panel.style.height = prevHeight;
          panel.style.maxHeight = prevMaxHeight;
          const maxH = Math.min(PANEL_SIZE.maxHeight || 1200, Math.floor(window.innerHeight * 0.95));
          const h = Math.max(PANEL_SIZE.minHeight, Math.min(maxH, contentHeight));
          panel.style.height = h + 'px';
          settings.panelHeight = h;
          saveSettings();
        });
      }
      detailsToggle.addEventListener('click', () => {
        settings.detailsCollapsed = !settings.detailsCollapsed;
        detailsEl.style.display = settings.detailsCollapsed ? 'none' : 'block';
        detailsToggle.textContent = settings.detailsCollapsed ? 'Show details ▼' : 'Hide details ▲';
        saveSettings();
        fitPanelHeightToContent();
      });
  
      dotToggle.addEventListener('change', () => {
        settings.dotPrefix = Boolean(dotToggle.checked);
        saveSettings();
        renderDebug('dot toggle');
      });
  
      panel.querySelector('#sag-start').addEventListener('click', startAutomation);
      panel.querySelector('#sag-stop').addEventListener('click', () => stopAutomation('Stopped by user'));
      panel.querySelector('#sag-refresh').addEventListener('click', () => {
        refreshCandidates('manual refresh');
        buildQueueFromCandidates({ preserveExisting: state.running });
        renderDebug('manual refresh');
      });
  
      panel.querySelector('#sag-add-word').addEventListener('click', () => {
        addWordToList(wordInput.value);
        wordInput.value = '';
      });
      panel.querySelector('#sag-remove-word').addEventListener('click', () => {
        removeWordFromList(wordInput.value);
        wordInput.value = '';
      });
      panel.querySelector('#sag-dedupe').addEventListener('click', () => {
        dedupeWordList();
      });

      const searchInput = panel.querySelector('#sag-search-input');
      const searchHint = panel.querySelector('#sag-search-hint');
      let currentSearchResults = [];
      let lastSearchQuery = '';

      searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        lastSearchQuery = query;
        if (query.trim()) {
          currentSearchResults = filterCandidates(query);
          renderTopCandidates(currentSearchResults);
          searchHint.style.display = 'block';
        } else {
          currentSearchResults = [];
          lastSearchQuery = '';
          renderTopCandidates();
          searchHint.style.display = 'none';
        }
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && currentSearchResults.length > 0) {
          e.preventDefault();
          const word = currentSearchResults[0];
          state.sentThisRound.add(normalizeWord(word));
          sendGuess(word);
          setTimeout(() => {
            searchInput.focus();
            if (lastSearchQuery) {
              searchInput.value = lastSearchQuery;
              currentSearchResults = filterCandidates(lastSearchQuery);
              renderTopCandidates(currentSearchResults);
              searchHint.style.display = 'block';
            }
          }, 100);
        } else if (e.key >= '1' && e.key <= '9' && currentSearchResults.length > 0) {
          e.preventDefault();
          const index = parseInt(e.key) - 1;
          if (index < currentSearchResults.length) {
            const word = currentSearchResults[index];
            state.sentThisRound.add(normalizeWord(word));
            sendGuess(word);
            setTimeout(() => {
              searchInput.focus();
              if (lastSearchQuery) {
                searchInput.value = lastSearchQuery;
                currentSearchResults = filterCandidates(lastSearchQuery);
                renderTopCandidates(currentSearchResults);
                searchHint.style.display = 'block';
              }
            }, 100);
          }
        }
      });
  
      // Guess delay — number input (main panel only)
      const delayInput = panel.querySelector('#sag-delay-input');
      delayInput.value = String(settings.delayMs ?? DEFAULT_SETTINGS.delayMs);
      delayInput.addEventListener('change', () => {
        const v = Number(delayInput.value);
        settings.delayMs = Math.max(LIMITS.delayMin, Math.min(LIMITS.delayMax, Number.isFinite(v) ? v : DEFAULT_SETTINGS.delayMs));
        delayInput.value = String(settings.delayMs);
        saveSettings();
      });

      // Refresh rate slider — controls the hint/chat polling interval (NOT guess delay)
      // Close-hit resends are always immediate regardless of this setting.
      const refreshRateSlider = panel.querySelector('#sag-refresh-rate');
      const refreshRateVal = panel.querySelector('#sag-refresh-rate-val');
      const initRR = Math.max(LIMITS.refreshRateMin, Math.min(LIMITS.refreshRateMax, settings.refreshRateMs ?? DEFAULT_SETTINGS.refreshRateMs));
      refreshRateSlider.value = String(initRR);
      refreshRateVal.textContent = `${initRR}ms`;
      refreshRateSlider.addEventListener('input', () => {
        const ms = Number(refreshRateSlider.value);
        settings.refreshRateMs = ms;
        refreshRateVal.textContent = `${ms}ms`;
        saveSettings();
      });

      // Close-hit scan slider — controls how fast the watcher polls for ".word is close!"
      // after a dot-prefixed guess is sent. Lower = faster detection, but slightly more CPU.
      const closeHitScanSlider = panel.querySelector('#sag-closehit-scan');
      const closeHitScanVal = panel.querySelector('#sag-closehit-scan-val');
      const initCHS = Math.max(LIMITS.closeHitScanMin, Math.min(LIMITS.closeHitScanMax, settings.closeHitScanMs ?? DEFAULT_SETTINGS.closeHitScanMs));
      closeHitScanSlider.value = String(initCHS);
      closeHitScanVal.textContent = `${initCHS}ms`;
      closeHitScanSlider.addEventListener('input', () => {
        const ms = Number(closeHitScanSlider.value);
        settings.closeHitScanMs = ms;
        closeHitScanVal.textContent = `${ms}ms`;
        saveSettings();
      });

      // Dev panel toggle (in main panel)
      const devToggle = panel.querySelector('#sag-dev-toggle');
      const showDev = settings.devPanelOpen ?? false;
      devPanel.style.display = showDev ? 'flex' : 'none';
      devToggle.textContent = showDev ? 'Hide' : 'Show';
      if (showDev) setTimeout(repositionDevPanel, 0);

      function toggleDevPanel(open) {
        devPanel.style.display = open ? 'flex' : 'none';
        devToggle.textContent = open ? 'Hide' : 'Show';
        settings.devPanelOpen = open;
        saveSettings();
        if (open) { repositionDevPanel(); renderDebug('dev panel open'); }
      }

      devToggle.addEventListener('click', () => toggleDevPanel(devPanel.style.display === 'none'));
      devPanel.querySelector('#sag-dev-close').addEventListener('click', () => toggleDevPanel(false));

      // Dev panel buttons
      devPanel.querySelector('#sag-dev-snap').addEventListener('click', () => {
        const snap = {
          running: state.running,
          wordGuessedThisRound: state.wordGuessedThisRound,
          selfName: getSelfName(),
          phase: state.lastGamePhase,
          candidates: state.candidates.length,
          sentThisRound: [...state.sentThisRound],
          lastGuess: state.lastGuess,
          rawHint: state.currentHintRaw,
          underscorePattern: state.currentUnderscorePattern,
          letterPattern: state.currentLetterPattern,
          queueLen: state.queue.length,
          delayMs: settings.delayMs,
          refreshRateMs: settings.refreshRateMs,
          closeHitScanMs: settings.closeHitScanMs,
        };
        const snapOut = devPanel.querySelector('#sag-dev-snap-out');
        snapOut.style.display = 'block';
        snapOut.textContent = JSON.stringify(snap, null, 2);
        devLog('info', 'State snapshot taken');
      });

      devPanel.querySelector('#sag-dev-force-hide').addEventListener('click', () => {
        state.wordGuessedThisRound = true;
        hideCandidates();
        devLog('info', 'Force-hide triggered');
      });

      devPanel.querySelector('#sag-dev-force-show').addEventListener('click', () => {
        state.wordGuessedThisRound = false;
        refreshCandidates('force-show');
        devLog('info', 'Force-show triggered');
      });

      devPanel.querySelector('#sag-dev-clear-sent').addEventListener('click', () => {
        state.sentThisRound.clear();
        renderTopCandidates();
        devLog('info', `Cleared sentThisRound set`);
      });

      devPanel.querySelector('#sag-dev-new-round').addEventListener('click', () => {
        startNewRound();
        devLog('round', 'Simulated new round');
      });

      devPanel.querySelector('#sag-dev-clear-log').addEventListener('click', () => {
        state.devLog = [];
        const logEl = devPanel.querySelector('#sag-dev-log');
        if (logEl) logEl.innerHTML = '';
      });

      devPanel.querySelector('#sag-dev-copy-log').addEventListener('click', () => {
        const text = state.devLog.map(e => `[${e.ts}] [${e.category}] ${e.message}`).join('\n');
        navigator.clipboard?.writeText(text).then(() => devLog('info', 'Log copied to clipboard'));
      });

      state.ui = {
        panel,
        devPanel,
        status: panel.querySelector('#sag-status'),
        hintRaw: panel.querySelector('#sag-hint-raw'),
        hintNormalized: panel.querySelector('#sag-hint-normalized'),
        hintCompact: panel.querySelector('#sag-hint-compact'),
        letterPattern: panel.querySelector('#sag-letter-pattern'),
        wordCount: panel.querySelector('#sag-word-count'),
        candidateCount: panel.querySelector('#sag-candidate-count'),
        candidateTop: panel.querySelector('#sag-candidate-top'),
        lastGuess: panel.querySelector('#sag-last-guess'),
        mode: panel.querySelector('#sag-mode'),
        phase: panel.querySelector('#sag-phase'),
        closeState: panel.querySelector('#sag-close'),
        cooldown: panel.querySelector('#sag-cooldown'),
        context: panel.querySelector('#sag-context'),
        devNickname: devPanel.querySelector('#sag-dev-nickname'),
        devLogEl: devPanel.querySelector('#sag-dev-log'),
      };
    }
  
    function initWithRetry() {
      if (!state.ui) {
        createPanel();
      }
  
      const found = bindGameSelectors();
      attachObservers();
      refreshCandidates('init');
  
      state.initAttempts++;
      if (!found && state.initAttempts <= LIMITS.maxRetries) {
        setStatus(`UI not ready, retry ${state.initAttempts}/${LIMITS.maxRetries}`);
        setTimeout(initWithRetry, 1500);
        return;
      }
  
      if (!found) {
        setStatus('Game UI not fully detected; monitoring for recovery', true);
      } else {
        setStatus('Ready');
      }
  
      state.initialized = true;

      if (state.ui?.panel) {
        ensurePanelVisible(state.ui.panel);
      }

      let lastRenderedHint = '';
      if (state.refreshLoopScheduled != null) {
        clearTimeout(state.refreshLoopScheduled);
        state.refreshLoopScheduled = null;
      }
      // Tertiary safety net: periodically check the game phase regardless of observers.
      // Only fires after a 45 s grace period since the word was guessed, because
      // skribbl stays in "guessing" phase while other players are still guessing — we
      // must not mistake that for a missed round transition.
      // 45 s covers the full skribbl round timer; "the word was" chat signals should
      // always arrive before then if the round ends normally.
      (function phasePoller() {
        if (
          state.initialized &&
          state.wordGuessedThisRound &&
          getGamePhase() === 'guessing' &&
          Date.now() - state.wordGuessedAt > 45000
        ) {
          devLog('round', 'Phase poller: guessing phase while word-guessed — auto-recovering');
          startNewRound();
        }
        setTimeout(phasePoller, 800);
      })();

      (function scheduleHintRefresh() {
        // Use settings.refreshRateMs so the slider actually controls the polling speed.
        // The close-hit scan also runs on every tick, so lower = faster close-hit detection.
        // Clamped to [50, 2000] to prevent accidental freeze or runaway CPU usage.
        const rate = Math.max(LIMITS.refreshRateMin, Math.min(LIMITS.refreshRateMax, settings.refreshRateMs ?? DEFAULT_SETTINGS.refreshRateMs));
        state.refreshLoopScheduled = setTimeout(() => {
          state.refreshLoopScheduled = null;

          if (state.initialized && state.ui && !state.isUserScrolling) {
            // Always run even when wordGuessedThisRound=true — auto-recovery inside
            // refreshCandidates depends on being called when a new round hint appears.
            const currentHint = getHintText() || '';
            if (currentHint && currentHint !== lastRenderedHint) {
              lastRenderedHint = currentHint;
              refreshCandidates('auto-refresh-hint-change');
            }

          }

          scheduleHintRefresh();
        }, rate);
      })();
    }
  
    onReady(async () => {
      await loadWords();
      initWithRetry();
  
      setInterval(() => {
        const hadInput = Boolean(state.selectors.input);
        bindGameSelectors();
        if (!hadInput && state.selectors.input) {
          setStatus('Recovered chat input');
        }
      }, 4000);
    });
  })();
