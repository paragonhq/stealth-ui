"use client";
import { Popover } from "@base-ui/react/popover";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Clock, Search } from "@/lib/icons";
import { ease, spring, swap } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";

/* ───────────────────────── data ───────────────────────── */
// A curated set of the emoji people actually reach for in product conversations:
// reactions, status, work objects. One line per emoji: glyph | name | keywords.
// A trailing "|t" marks emoji that take a skin tone.

export type EmojiCategoryKey = "smileys" | "people" | "nature" | "food" | "activity" | "travel" | "objects" | "symbols" | "flags";

export type EmojiEntry = { emoji: string; name: string; keywords: string; tone: boolean; category: EmojiCategoryKey };

const raw: Record<EmojiCategoryKey, string> = {
  smileys: `
😀|grinning face|smile happy
😃|grinning face with big eyes|smile happy joy
😄|grinning face with smiling eyes|smile happy laugh
😁|beaming face|grin smile teeth
😆|grinning squinting face|laugh lol
😅|grinning face with sweat|relief nervous phew
🤣|rolling on the floor laughing|rofl lol lmao
😂|face with tears of joy|lol laugh crying
🙂|slightly smiling face|smile fine
🙃|upside down face|silly sarcasm
😉|winking face|wink flirt
😊|smiling face with smiling eyes|blush happy
😇|smiling face with halo|angel innocent
🥰|smiling face with hearts|love adore
😍|smiling face with heart eyes|love crush
🤩|star struck|wow amazing excited
😘|face blowing a kiss|kiss love
😋|face savoring food|yum delicious
😛|face with tongue|tongue playful
😜|winking face with tongue|crazy joke
🤪|zany face|goofy wild
🤑|money mouth face|rich money
🤗|hugging face|hug thanks
🤭|face with hand over mouth|oops giggle
🫢|face with open eyes and hand over mouth|shock gasp
🤫|shushing face|quiet secret
🤔|thinking face|hmm think consider
🫡|saluting face|salute respect ok
🤐|zipper mouth face|secret quiet
🤨|face with raised eyebrow|skeptical suspicious
😐|neutral face|meh blank
😑|expressionless face|blank unamused
😶|face without mouth|speechless silent
🫥|dotted line face|invisible hidden
😏|smirking face|smirk smug
😒|unamused face|meh annoyed
🙄|face with rolling eyes|eyeroll whatever
😬|grimacing face|awkward yikes
😮‍💨|face exhaling|sigh relief tired
😌|relieved face|calm content
😔|pensive face|sad thoughtful
😪|sleepy face|tired
😴|sleeping face|sleep zzz tired
😷|face with medical mask|sick mask ill
🤒|face with thermometer|sick fever
🤢|nauseated face|sick gross
🥵|hot face|heat sweating
🥶|cold face|freezing
🥴|woozy face|dizzy tipsy
😵‍💫|face with spiral eyes|dizzy confused
🤯|exploding head|mind blown shocked
🤠|cowboy hat face|yeehaw
🥳|partying face|party celebrate birthday
🥸|disguised face|incognito
😎|smiling face with sunglasses|cool
🤓|nerd face|geek smart
🧐|face with monocle|inspect curious
😕|confused face|unsure
🫤|face with diagonal mouth|skeptical unsure
😟|worried face|concern nervous
🙁|slightly frowning face|sad
😮|face with open mouth|wow surprise
😲|astonished face|shock amazed
😳|flushed face|embarrassed blush
🥺|pleading face|please puppy eyes
🥹|face holding back tears|touched grateful
😨|fearful face|scared
😰|anxious face with sweat|nervous stress
😢|crying face|sad tear
😭|loudly crying face|sob sad
😱|face screaming in fear|scream horror
😩|weary face|tired frustrated
😫|tired face|exhausted
🥱|yawning face|bored tired
😤|face with steam from nose|triumph frustrated
😡|enraged face|angry mad
🤬|face with symbols on mouth|swear angry
😈|smiling face with horns|devil mischief
💀|skull|dead lol
💩|pile of poo|poop
🤡|clown face|clown
👻|ghost|boo halloween
👽|alien|ufo extraterrestrial
🤖|robot|bot ai automation`,
  people: `
👋|waving hand|hello hi bye wave|t
🤚|raised back of hand|stop|t
✋|raised hand|high five stop|t
🖖|vulcan salute|spock|t
👌|ok hand|okay perfect|t
🤌|pinched fingers|italian what|t
🤏|pinching hand|small tiny little|t
✌️|victory hand|peace two|t
🤞|crossed fingers|luck hope|t
🫰|hand with index finger and thumb crossed|love money|t
🤟|love you gesture|ily|t
🤘|sign of the horns|rock metal|t
🤙|call me hand|shaka call|t
👈|backhand index pointing left|left point|t
👉|backhand index pointing right|right point|t
👆|backhand index pointing up|up point above|t
👇|backhand index pointing down|down point below|t
☝️|index pointing up|one first|t
🫵|index pointing at the viewer|you point|t
👍|thumbs up|yes approve like agree +1|t
👎|thumbs down|no disapprove dislike -1|t
✊|raised fist|power solidarity|t
👊|oncoming fist|punch bump|t
👏|clapping hands|applause bravo congrats|t
🙌|raising hands|celebrate hooray praise|t
🫶|heart hands|love thanks|t
👐|open hands|hug jazz|t
🤲|palms up together|prayer offer|t
🙏|folded hands|please thanks pray|t
✍️|writing hand|write sign|t
💪|flexed biceps|strong muscle|t
🤝|handshake|deal agreement partner
👀|eyes|look watching see
🧠|brain|smart think idea
🫂|people hugging|hug support comfort
🧑‍💻|technologist|developer engineer coder laptop|t
🧑‍🎨|artist|designer painter creative|t
🧑‍🔬|scientist|research lab|t
🧑‍🚀|astronaut|space rocket|t
🧑‍🍳|cook|chef kitchen|t
🙋|person raising hand|question me volunteer|t
🙇|person bowing|sorry respect thanks|t
🤷|person shrugging|dunno whatever shrug|t
🤦|person facepalming|facepalm ugh|t
💁|person tipping hand|info sass|t
🏃|person running|run hurry late|t`,
  nature: `
🐶|dog face|puppy pet
🐱|cat face|kitty pet
🐭|mouse face|mouse
🐰|rabbit face|bunny
🦊|fox|fox clever
🐻|bear|bear
🐼|panda|panda
🐨|koala|koala
🐯|tiger face|tiger
🦁|lion|lion king
🐮|cow face|cow
🐷|pig face|pig
🐸|frog|frog
🐵|monkey face|monkey
🙈|see no evil monkey|oops shy
🐔|chicken|chicken
🐧|penguin|penguin
🦉|owl|owl wise night
🐝|honeybee|bee busy
🦋|butterfly|butterfly
🐢|turtle|slow turtle
🐍|snake|snake python
🐙|octopus|octopus
🐬|dolphin|dolphin
🐳|spouting whale|whale docker
🦄|unicorn|unicorn magic startup
🌵|cactus|desert plant
🌲|evergreen tree|tree pine forest
🌴|palm tree|beach tropical
🌱|seedling|grow sprout new
🌿|herb|leaf plant
🍀|four leaf clover|luck lucky
🍁|maple leaf|autumn fall canada
🌸|cherry blossom|flower spring
🌻|sunflower|flower summer
🌹|rose|flower love
🌈|rainbow|pride colors
☀️|sun|sunny weather
🌙|crescent moon|night moon
⭐|star|favorite star
⚡|high voltage|lightning fast zap
❄️|snowflake|cold winter freeze
🔥|fire|hot lit flame
🌊|water wave|ocean sea wave
💧|droplet|water drop`,
  food: `
🍎|red apple|apple fruit
🍐|pear|pear fruit
🍊|tangerine|orange fruit
🍋|lemon|lemon sour
🍌|banana|banana fruit
🍉|watermelon|watermelon summer
🍇|grapes|grapes wine
🍓|strawberry|strawberry berry
🫐|blueberries|blueberry
🍒|cherries|cherry
🍑|peach|peach
🥭|mango|mango
🍍|pineapple|pineapple
🥥|coconut|coconut
🥑|avocado|avocado toast
🍅|tomato|tomato
🥕|carrot|carrot vegetable
🌽|ear of corn|corn
🌶️|hot pepper|spicy chili
🥐|croissant|breakfast pastry french
🍞|bread|toast loaf
🧀|cheese wedge|cheese
🥚|egg|egg breakfast
🥓|bacon|bacon breakfast
🥞|pancakes|breakfast pancakes
🍔|hamburger|burger
🍟|french fries|fries chips
🍕|pizza|pizza slice
🌮|taco|taco mexican
🌯|burrito|burrito wrap
🥗|green salad|salad healthy
🍣|sushi|sushi japanese
🍜|steaming bowl|ramen noodles
🍝|spaghetti|pasta
🍩|doughnut|donut sweet
🍪|cookie|cookie biscuit
🎂|birthday cake|birthday cake
🍰|shortcake|cake dessert
🍫|chocolate bar|chocolate sweet
🍿|popcorn|movie snack
☕|hot beverage|coffee tea morning
🍵|teacup without handle|tea matcha
🧋|bubble tea|boba
🥤|cup with straw|soda drink
🍺|beer mug|beer drink
🍷|wine glass|wine
🥂|clinking glasses|cheers toast celebrate
🍾|bottle with popping cork|champagne celebrate launch`,
  activity: `
⚽|soccer ball|football sport
🏀|basketball|basketball sport
🏈|american football|football
⚾|baseball|baseball
🎾|tennis|tennis
🏐|volleyball|volleyball
🏓|ping pong|table tennis
⛳|flag in hole|golf
🎯|direct hit|target bullseye goal
🏆|trophy|win award champion
🥇|1st place medal|gold first winner
🥈|2nd place medal|silver second
🥉|3rd place medal|bronze third
🏅|sports medal|medal award
🎮|video game|gaming controller
🕹️|joystick|arcade game
🎲|game die|dice random
🧩|puzzle piece|puzzle integration
♟️|chess pawn|chess strategy
🎨|artist palette|design art paint
🎬|clapper board|film movie action
🎤|microphone|sing karaoke
🎧|headphone|music listen
🎸|guitar|music rock
🎹|musical keyboard|piano music
🎉|party popper|celebrate congrats tada
🎊|confetti ball|celebrate party
🎁|wrapped gift|present gift birthday
🎈|balloon|party birthday`,
  travel: `
🚗|automobile|car drive
🚕|taxi|cab
🚌|bus|bus transit
🚲|bicycle|bike cycle
🛴|kick scooter|scooter
🚄|high speed train|train fast
✈️|airplane|flight travel plane
🛫|airplane departure|takeoff flight
🚀|rocket|launch ship deploy space
🛸|flying saucer|ufo
🚁|helicopter|helicopter
⛵|sailboat|boat sail
🚢|ship|cruise boat
⚓|anchor|anchor harbour
🗺️|world map|map travel
🧭|compass|direction navigate
🏔️|snow capped mountain|mountain
🏕️|camping|camp tent
🏖️|beach with umbrella|beach holiday vacation
🏝️|desert island|island vacation
🏙️|cityscape|city skyline
🏠|house|home
🏢|office building|office work company
🏰|castle|castle
🗽|statue of liberty|new york
🌍|globe showing europe africa|world earth global
🌎|globe showing americas|world earth global
🌏|globe showing asia australia|world earth global`,
  objects: `
💻|laptop|computer work mac
⌨️|keyboard|type keyboard
🖥️|desktop computer|monitor screen
🖱️|computer mouse|mouse click
📱|mobile phone|phone iphone
☎️|telephone|phone call
📷|camera|photo picture
🎥|movie camera|video film
📺|television|tv
🔋|battery|battery power
🔌|electric plug|plug power
💡|light bulb|idea bright
🔦|flashlight|torch
🕯️|candle|candle light
📚|books|library read study
📖|open book|read docs
📝|memo|note write todo
✏️|pencil|edit write
🖊️|pen|write sign
📌|pushpin|pin important
📎|paperclip|attach attachment
✂️|scissors|cut
📁|file folder|folder directory
🗂️|card index dividers|organize files
📅|calendar|date schedule
📊|bar chart|stats analytics
📈|chart increasing|growth up metrics
📉|chart decreasing|down drop metrics
🔒|locked|lock secure private
🔓|unlocked|unlock open
🔑|key|password key access
🔨|hammer|build fix
🛠️|hammer and wrench|tools fix build
⚙️|gear|settings config
🧪|test tube|test experiment lab
🔬|microscope|research science
💊|pill|medicine
💰|money bag|money revenue
💳|credit card|payment card billing
📦|package|box ship delivery release
✉️|envelope|email mail letter
📣|megaphone|announce announcement
🔔|bell|notification alert
⏰|alarm clock|alarm time wake
⏳|hourglass not done|waiting time loading
🗑️|wastebasket|trash delete bin`,
  symbols: `
❤️|red heart|love like
🧡|orange heart|love
💛|yellow heart|love
💚|green heart|love
💙|blue heart|love
💜|purple heart|love
🖤|black heart|love
🤍|white heart|love
💔|broken heart|heartbreak sad
❤️‍🔥|heart on fire|passion love
💯|hundred points|100 perfect score
✅|check mark button|done yes complete
☑️|check box with check|done checked
✔️|check mark|done yes
❌|cross mark|no wrong cancel
❎|cross mark button|no cancel
➕|plus|add plus
➖|minus|subtract minus
❓|red question mark|question help
❗|red exclamation mark|important alert
‼️|double exclamation mark|urgent
⚠️|warning|caution alert
🚫|prohibited|forbidden no ban
⛔|no entry|stop blocked
🔴|red circle|red status
🟠|orange circle|orange status
🟡|yellow circle|yellow status
🟢|green circle|green status online
🔵|blue circle|blue status
🟣|purple circle|purple
⚫|black circle|black
⚪|white circle|white
♻️|recycling symbol|recycle reuse
🆕|new button|new
🆗|ok button|ok okay
🔝|top arrow|top
▶️|play button|play start
⏸️|pause button|pause
⏹️|stop button|stop
🔁|repeat button|repeat loop retry
➡️|right arrow|right next
⬅️|left arrow|left back
⬆️|up arrow|up
⬇️|down arrow|down
💤|zzz|sleep
💬|speech balloon|comment chat message
💭|thought balloon|thinking
👁️‍🗨️|eye in speech bubble|witness`,
  flags: `
🏁|chequered flag|finish race done
🚩|triangular flag|red flag warning
🏳️|white flag|surrender
🏴|black flag|flag
🏳️‍🌈|rainbow flag|pride lgbt
🇺🇸|flag united states|usa america us
🇬🇧|flag united kingdom|uk britain gb
🇨🇦|flag canada|canada ca
🇩🇪|flag germany|germany de
🇫🇷|flag france|france fr
🇪🇸|flag spain|spain es
🇮🇹|flag italy|italy it
🇳🇱|flag netherlands|netherlands nl dutch
🇸🇪|flag sweden|sweden se
🇯🇵|flag japan|japan jp
🇰🇷|flag south korea|korea kr
🇮🇳|flag india|india in
🇧🇷|flag brazil|brazil br
🇲🇽|flag mexico|mexico mx
🇦🇺|flag australia|australia au`,
};

const categories: { key: EmojiCategoryKey; label: string }[] = [
  { key: "smileys", label: "Smileys" },
  { key: "people", label: "People & hands" },
  { key: "nature", label: "Animals & nature" },
  { key: "food", label: "Food & drink" },
  { key: "activity", label: "Activities" },
  { key: "travel", label: "Travel & places" },
  { key: "objects", label: "Objects" },
  { key: "symbols", label: "Symbols" },
  { key: "flags", label: "Flags" },
];

const emojis: EmojiEntry[] = categories.flatMap(({ key }) =>
  raw[key]
    .trim()
    .split("\n")
    .map((line) => {
      const [emoji, name, keywords, tone] = line.split("|");
      return { emoji, name, keywords, tone: tone === "t", category: key };
    }),
);

/* ───────────────────────── skin tones ───────────────────────── */

const TONES = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"] as const;
const TONE_NAMES = ["Default", "Light", "Medium-light", "Medium", "Medium-dark", "Dark"];
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

/** Puts a skin tone modifier after the first code point (dropping a variation selector there), which also works for ZWJ people like 🧑‍💻. */
export function withSkinTone(emoji: string, tone: SkinTone) {
  if (!tone) return emoji;
  const [first, ...rest] = [...emoji];
  if (rest[0] === "️") rest.shift();
  return first + TONES[tone] + rest.join("");
}

export type PickedEmoji = { emoji: string; base: string; name: string; shortcode: string };
const shortcode = (name: string) => `:${name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}:`;
const byGlyph = new Map(emojis.map((e) => [e.emoji, e]));

function search(q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const direct = byGlyph.get(query);
  if (direct) return [direct];
  const tokens = query.replace(/^:|:$/g, "").split(/[\s_]+/).filter(Boolean);
  const scored: { e: EmojiEntry; score: number }[] = [];
  for (const e of emojis) {
    const hay = ` ${e.name} ${e.keywords} `.toLowerCase();
    if (!tokens.every((t) => hay.includes(` ${t}`))) continue;
    // Names that start with the query first, then names that contain it, then keyword hits.
    const score = e.name.startsWith(tokens[0]) ? 0 : ` ${e.name}`.includes(` ${tokens[0]}`) ? 1 : 2;
    scored.push({ e, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.e);
}

/* ───────────────────────── icons ───────────────────────── */

const svg = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const CategoryIcon = ({ k }: { k: string }) => {
  switch (k) {
    case "recent": return <Clock />;
    case "smileys": return <svg {...svg}><circle cx="8" cy="8" r="5.75" /><path d="M5.75 9.5a2.75 2.75 0 0 0 4.5 0" /><circle cx="6" cy="6.75" r=".6" fill="currentColor" stroke="none" /><circle cx="10" cy="6.75" r=".6" fill="currentColor" stroke="none" /></svg>;
    case "people": return <svg {...svg}><path d="M6 8.5V4a1 1 0 0 1 2 0v3.5M8 7V3.25a1 1 0 0 1 2 0V7.5M10 7.5V4.5a1 1 0 0 1 2 0v4.25a5 5 0 0 1-5 5 4.5 4.5 0 0 1-3.6-1.8L2.3 10.4a1 1 0 0 1 1.5-1.3L6 10.5" /></svg>;
    case "nature": return <svg {...svg}><path d="M3.5 12.5c0-5 3.5-8.5 9-9-.5 5.5-4 9-9 9zM3.5 12.5 8 8" /></svg>;
    case "food": return <svg {...svg}><path d="M3.5 6.5h8v2.25a4 4 0 0 1-8 0zM11.5 7h.75a1.75 1.75 0 0 1 0 3.5h-1.1M6 2.75v1.5M8.5 2.75v1.5" /></svg>;
    case "activity": return <svg {...svg}><circle cx="8" cy="8" r="5.75" /><path d="M2.5 6.5c2 .5 4 2.5 4.5 7M13.5 9.5c-2-.5-4-2.5-4.5-7M4 3.75c1.5 2.5 5.5 6 8 8.5" /></svg>;
    case "travel": return <svg {...svg}><path d="M3 10.5 4.25 6.5a1.5 1.5 0 0 1 1.4-1h4.7a1.5 1.5 0 0 1 1.4 1L13 10.5M2.75 10.5h10.5v2h-10.5zM4.5 12.5v1M11.5 12.5v1" /></svg>;
    case "objects": return <svg {...svg}><path d="M6 11.5h4M6.5 13.5h3M8 2.5a4 4 0 0 0-2.4 7.2c.3.25.4.55.4.9v.9h4v-.9c0-.35.1-.65.4-.9A4 4 0 0 0 8 2.5z" /></svg>;
    case "symbols": return <svg {...svg}><path d="M8 13.25S2.25 10 2.25 6.1A2.85 2.85 0 0 1 8 4.9a2.85 2.85 0 0 1 5.75 1.2C13.75 10 8 13.25 8 13.25z" /></svg>;
    case "flags": return <svg {...svg}><path d="M3.5 13.75V2.75M3.5 3.25h8l-1.75 2.75 1.75 2.75h-8" /></svg>;
    default: return <Search />;
  }
};

function SmileyPlus() {
  return (
    <svg {...svg}>
      <path d="M13.6 7.1A5.75 5.75 0 1 1 8.9 2.3" />
      <path d="M5.75 9.5a2.75 2.75 0 0 0 4.5 0" />
      <circle cx="6" cy="6.75" r=".6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6.75" r=".6" fill="currentColor" stroke="none" />
      <path d="M12.25 1.75v3.5M10.5 3.5H14" />
    </svg>
  );
}

/* ───────────────────────── the panel ───────────────────────── */

const COLS = 8;
const CELL = 34;
type Section = { key: string; label: string; items: EmojiEntry[] };
type Cell = { id: string; entry: EmojiEntry; row: number; col: number };

export type EmojiPickerPanelProps = Omit<React.ComponentProps<"div">, "onSelect"> & {
  onEmojiSelect?: (picked: PickedEmoji) => void;
  skinTone?: SkinTone;
  defaultSkinTone?: SkinTone;
  onSkinToneChange?: (tone: SkinTone) => void;
  /** Base glyphs, most recent first. The row reorders the next time the panel mounts, so nothing moves under the pointer. */
  recent?: string[];
  defaultRecent?: string[];
  onRecentChange?: (recent: string[]) => void;
  recentLimit?: number;
  /** Focus the search field on mount. */
  autoFocus?: boolean;
};

export function EmojiPickerPanel({
  onEmojiSelect,
  skinTone: toneProp,
  defaultSkinTone = 0,
  onSkinToneChange,
  recent: recentProp,
  defaultRecent = [],
  onRecentChange,
  recentLimit = 16,
  autoFocus = false,
  className,
  ...rest
}: EmojiPickerPanelProps) {
  const uid = useId();
  const reduce = useReducedMotion();
  const [tone, setTone] = useControllableState<SkinTone>({ value: toneProp, defaultValue: defaultSkinTone, onChange: onSkinToneChange });
  const [recent, setRecent] = useControllableState({ value: recentProp, defaultValue: defaultRecent, onChange: onRecentChange });
  // The recent row as it was when the panel opened.
  const [shownRecent] = useState(recent);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<{ id: string; via: "pointer" | "keyboard" } | null>(null);
  const [gridMode, setGridMode] = useState(false);
  const [spy, setSpy] = useState<string>(shownRecent.length ? "recent" : "smileys");
  const [toneOpen, setToneOpen] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toneButton = useRef<HTMLButtonElement>(null);
  const jumpLock = useRef<number>(undefined);
  const hx = useMotionValue(0);
  const hy = useMotionValue(0);
  const shownOnce = useRef(false);

  const searching = query.trim().length > 0;
  const sections: Section[] = useMemo(() => {
    if (searching) return [{ key: "results", label: "Results", items: search(query) }];
    const recentItems = shownRecent.map((g) => byGlyph.get(g)).filter((e): e is EmojiEntry => !!e);
    return [
      ...(recentItems.length ? [{ key: "recent", label: "Recent", items: recentItems }] : []),
      ...categories.map((c) => ({ key: c.key, label: c.label, items: emojis.filter((e) => e.category === c.key) })),
    ];
  }, [searching, query, shownRecent]);

  // Rows across every section, for arrow keys that cross section boundaries.
  const { rows, byId } = useMemo(() => {
    const rows: Cell[][] = [];
    const byId = new Map<string, Cell>();
    for (const s of sections) {
      for (let i = 0; i < s.items.length; i += COLS) {
        const row = s.items.slice(i, i + COLS).map((entry, c) => {
          const cell = { id: `${uid}-${s.key}-${i + c}`, entry, row: rows.length, col: c };
          byId.set(cell.id, cell);
          return cell;
        });
        rows.push(row);
      }
    }
    return { rows, byId };
  }, [sections, uid]);

  const activeCell = active ? byId.get(active.id) : undefined;
  const preview = activeCell?.entry;

  // Glide one highlight to the active cell. Keyboard moves and first appearances jump.
  useLayoutEffect(() => {
    const el = activeCell ? document.getElementById(activeCell.id) : null;
    if (!el) return;
    const x = el.offsetLeft, y = el.offsetTop;
    if (active?.via === "pointer" && shownOnce.current && !reduce) {
      const a = animate(hx, x, spring.follow);
      const b = animate(hy, y, spring.follow);
      return () => {
        a.stop();
        b.stop();
      };
    }
    hx.set(x);
    hy.set(y);
    shownOnce.current = true;
    if (active?.via === "keyboard") el.scrollIntoView({ block: "nearest" });
  }, [activeCell, active?.via, hx, hy, reduce]);

  useLayoutEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);
  useLayoutEffect(() => () => window.clearTimeout(jumpLock.current), []);

  const pick = (entry: EmojiEntry) => {
    const glyph = entry.tone ? withSkinTone(entry.emoji, tone) : entry.emoji;
    setRecent([entry.emoji, ...recent.filter((g) => g !== entry.emoji)].slice(0, recentLimit));
    onEmojiSelect?.({ emoji: glyph, base: entry.emoji, name: entry.name, shortcode: shortcode(entry.name) });
  };

  const moveTo = (cell: Cell | undefined) => cell && setActive({ id: cell.id, via: "keyboard" });

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const cur = activeCell;
    const grid = !query || gridMode;
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setGridMode(true);
        if (!cur) return moveTo(rows[0]?.[0]);
        const next = rows[cur.row + 1];
        return moveTo(next?.[Math.min(cur.col, next.length - 1)]);
      }
      case "ArrowUp": {
        e.preventDefault();
        setGridMode(true);
        if (!cur) return;
        const prev = rows[cur.row - 1];
        return moveTo(prev?.[Math.min(cur.col, prev.length - 1)]);
      }
      case "ArrowRight":
      case "ArrowLeft": {
        if (!grid) return;
        e.preventDefault();
        setGridMode(true);
        const flat = rows.flat();
        const i = cur ? flat.findIndex((c) => c.id === cur.id) : -1;
        return moveTo(flat[Math.max(0, Math.min(flat.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))]);
      }
      case "Enter": {
        e.preventDefault();
        const target = cur?.entry ?? (searching ? rows[0]?.[0]?.entry : undefined);
        if (target) pick(target);
        return;
      }
      case "Escape":
        if (query) {
          // The first Escape clears the search; the next one closes whatever holds the panel.
          e.preventDefault();
          e.stopPropagation();
          setQuery("");
          setActive(null);
        }
        return;
    }
  };

  const onScroll = () => {
    if (jumpLock.current !== undefined || searching) return;
    const el = scroller.current;
    if (!el) return;
    let current: string | undefined = sections[0]?.key;
    for (const s of el.querySelectorAll<HTMLElement>("[data-section]")) {
      if (s.offsetTop - 1 <= el.scrollTop) current = s.dataset.section;
    }
    if (current && current !== spy) setSpy(current);
  };

  const jump = (key: string, instant: boolean) => {
    const el = scroller.current;
    const target = el?.querySelector<HTMLElement>(`[data-section="${key}"]`);
    if (!el || !target) return;
    setSpy(key);
    window.clearTimeout(jumpLock.current);
    // Hold the indicator on the target while a smooth scroll passes the sections in between.
    jumpLock.current = window.setTimeout(() => (jumpLock.current = undefined), instant || reduce ? 50 : 700);
    el.scrollTo({ top: target.offsetTop, behavior: instant || reduce ? "auto" : "smooth" });
  };

  const tabKeys = [...(shownRecent.length ? ["recent"] : []), ...categories.map((c) => c.key)];
  const tabLabel = (k: string) => (k === "recent" ? "Recent" : categories.find((c) => c.key === k)!.label);

  return (
    <div className={cn("flex w-[296px] max-w-full flex-col overflow-hidden", className)} {...rest}>
      {/* Search and skin tone */}
      <div className="relative flex items-center gap-2 p-2 pb-1.5">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-2 bg-raised px-2.5 transition-[border-color,box-shadow] duration-150 focus-within:border-fg-4 focus-within:ring-3 focus-within:ring-fg/10">
          <Search size={14} className="shrink-0 text-fg-4" />
          <span className="sr-only">Search emoji</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const q = e.target.value;
              setQuery(q);
              setGridMode(false);
              // While searching, the first result is ready for Enter.
              const first = q.trim() ? search(q)[0] : undefined;
              setActive(first ? { id: `${uid}-results-0`, via: "keyboard" } : null);
              scroller.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={onSearchKey}
            role="combobox"
            aria-expanded
            aria-haspopup="grid"
            aria-controls={`${uid}-grid`}
            aria-activedescendant={activeCell?.id}
            aria-autocomplete="list"
            placeholder="Search emoji"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[13px]"
          />
        </label>
        <button
          ref={toneButton}
          type="button"
          onClick={() => setToneOpen(true)}
          aria-label={`Skin tone: ${TONE_NAMES[tone]}`}
          aria-expanded={toneOpen}
          className="relative grid size-8 shrink-0 place-items-center rounded-lg text-[18px] leading-none outline-none transition-[background-color,scale] duration-150 hover:bg-fg/5 active:scale-[0.92] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={tone} initial={reduce ? { opacity: 0 } : swap.initial} animate={swap.animate} exit={reduce ? { opacity: 0 } : swap.exit} transition={reduce ? { duration: 0.12 } : spring.pop}>
              {withSkinTone("✋", tone)}
            </motion.span>
          </AnimatePresence>
        </button>

        <AnimatePresence>
          {toneOpen && (
            <ToneStrip
              tone={tone}
              reduce={!!reduce}
              onChoose={(t) => {
                setTone(t);
                setToneOpen(false);
                toneButton.current?.focus();
              }}
              onDismiss={() => {
                setToneOpen(false);
                toneButton.current?.focus();
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Category jumps; the pill follows the scroll. */}
      <div role="toolbar" aria-label="Emoji categories" className={cn("flex items-center justify-between px-2 pb-1 transition-opacity duration-150", searching && "pointer-events-none opacity-40")}>
        {tabKeys.map((k) => {
          const on = !searching && spy === k;
          return (
            <button
              key={k}
              type="button"
              aria-label={tabLabel(k)}
              title={tabLabel(k)}
              aria-current={on || undefined}
              tabIndex={searching ? -1 : 0}
              onClick={(e) => jump(k, e.detail === 0)}
              className={cn(
                "relative grid size-7 place-items-center rounded-md outline-none transition-[color,scale] duration-150 active:scale-[0.9] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3",
                on ? "text-fg" : "text-fg-3 hover:text-fg-2",
              )}
            >
              {on && <motion.span layoutId={reduce ? undefined : `${uid}-tab`} aria-hidden className="absolute inset-0 rounded-md bg-fg/[0.08]" transition={spring.snappy} />}
              <span className="relative">
                <CategoryIcon k={k} />
              </span>
            </button>
          );
        })}
      </div>

      {/* The grid. Focus stays in search; arrows move the active cell. */}
      <div
        ref={scroller}
        onScroll={onScroll}
        className="relative h-[264px] overflow-y-auto overscroll-contain border-t border-line px-1 pb-2 [scrollbar-gutter:stable_both-edges]"
      >
        <div id={`${uid}-grid`} role="grid" aria-label={searching ? "Search results" : "Emoji"} aria-rowcount={rows.length} className="relative">
          {activeCell && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 rounded-lg bg-fg/[0.08]"
              style={{ x: hx, y: hy, width: CELL, height: CELL }}
            />
          )}
          {sections.map((s) => (
            <div key={s.key} role="rowgroup" aria-label={s.label} data-section={s.key}>
              <div aria-hidden className="sticky top-0 z-10 flex h-7 items-end bg-raised px-1 pb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                {s.key === "results" ? (s.items.length === 1 ? "1 result" : `${s.items.length} results`) : s.label}
              </div>
              {s.items.length === 0 && s.key === "results" && (
                <div className="flex flex-col items-center gap-1 px-4 pb-6 pt-10 text-center">
                  <p className="text-[13px] text-fg-2">No emoji match “{query.trim()}”</p>
                  <p className="text-[12px] text-fg-3">Try a feeling or an object, like “party” or “rocket”.</p>
                </div>
              )}
              {rows
                .filter((r) => r[0] && r[0].id.startsWith(`${uid}-${s.key}-`))
                .map((r) => (
                  <div key={r[0].id} role="row" className="flex">
                    {r.map((c) => {
                      const glyph = c.entry.tone ? withSkinTone(c.entry.emoji, tone) : c.entry.emoji;
                      return (
                        <div
                          key={c.id}
                          id={c.id}
                          role="gridcell"
                          aria-label={c.entry.name}
                          aria-selected={activeCell?.id === c.id}
                          onPointerEnter={() => setActive({ id: c.id, via: "pointer" })}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(c.entry)}
                          className="group/cell relative grid shrink-0 cursor-default scroll-mt-8 scroll-mb-1 select-none place-items-center"
                          style={{ width: CELL, height: CELL }}
                        >
                          <span className="text-[22px] leading-none transition-[scale] duration-100 ease-out group-active/cell:scale-[0.82]">{glyph}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Preview of what Enter or a click will insert. */}
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-t border-line px-3">
        {preview ? (
          <>
            <span className="text-[24px] leading-none" aria-hidden>
              {preview.tone ? withSkinTone(preview.emoji, tone) : preview.emoji}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-medium first-letter:uppercase text-fg">{preview.name}</span>
              <span className="truncate font-mono text-[11px] text-fg-3">{shortcode(preview.name)}</span>
            </div>
          </>
        ) : (
          <span className="text-[12px] text-fg-3">Pick an emoji, or search by name</span>
        )}
      </div>
    </div>
  );
}

function ToneStrip({ tone, reduce, onChoose, onDismiss }: { tone: SkinTone; reduce: boolean; onChoose: (t: SkinTone) => void; onDismiss: () => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState<number>(tone);
  useLayoutEffect(() => {
    refs.current[focus]?.focus();
  }, [focus]);
  return (
    <motion.div
      role="radiogroup"
      aria-label="Skin tone"
      className="absolute inset-y-2 right-2 z-20 flex items-center justify-end gap-0.5 rounded-lg border border-line-2 bg-raised px-1 shadow-pop"
      initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 0 calc(100% - 32px) round 8px)", opacity: 0.6 }}
      animate={{ clipPath: "inset(0 0 0 0% round 8px)", opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { clipPath: "inset(0 0 0 calc(100% - 32px) round 8px)", opacity: 0, transition: { duration: 0.14, ease: ease.in } }}
      transition={{ duration: 0.22, ease: ease.out }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          setFocus((f) => (f + (e.key === "ArrowRight" ? 1 : -1) + 6) % 6);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onDismiss();
      }}
    >
      {TONES.map((_, t) => (
        <motion.button
          key={t}
          ref={(el) => {
            refs.current[t] = el;
          }}
          type="button"
          role="radio"
          aria-checked={tone === t}
          aria-label={TONE_NAMES[t]}
          tabIndex={focus === t ? 0 : -1}
          onClick={() => onChoose(t as SkinTone)}
          initial={reduce ? false : { opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: ease.out, delay: reduce ? 0 : (5 - t) * 0.018 }}
          className="relative grid size-7 place-items-center rounded-md text-[18px] leading-none outline-none transition-[background-color,scale] duration-150 hover:bg-fg/5 active:scale-[0.88] focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-fg-3 aria-checked:bg-fg/[0.08]"
        >
          {withSkinTone("✋", t as SkinTone)}
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ───────────────────────── the popover ───────────────────────── */

export type EmojiPickerProps = Omit<EmojiPickerPanelProps, "className" | "autoFocus"> & {
  /** Your own trigger element. Defaults to an "Add reaction" icon button. */
  trigger?: React.ReactElement<Record<string, unknown>>;
  /** Accessible name for the default trigger and the popup. */
  label?: string;
  /** Close after a pick. Turn off for composers where people insert several in a row. */
  closeOnSelect?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  className?: string;
};

export function EmojiPicker({
  trigger,
  label = "Add reaction",
  closeOnSelect = true,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  side = "bottom",
  align = "start",
  className,
  onEmojiSelect,
  recent: recentProp,
  defaultRecent = [],
  onRecentChange,
  skinTone: toneProp,
  defaultSkinTone = 0,
  onSkinToneChange,
  ...panel
}: EmojiPickerProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  // Lifted here so they outlive the popup unmounting between opens.
  const [recent, setRecent] = useControllableState({ value: recentProp, defaultValue: defaultRecent, onChange: onRecentChange });
  const [tone, setTone] = useControllableState<SkinTone>({ value: toneProp, defaultValue: defaultSkinTone, onChange: onSkinToneChange });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {trigger ? (
        <Popover.Trigger render={trigger} />
      ) : (
        <Popover.Trigger
          aria-label={label}
          className={cn(
            "grid size-8 place-items-center rounded-lg text-fg-3 outline-none transition-[background-color,color,scale] duration-150 hover:bg-fg/5 hover:text-fg active:scale-[0.92] data-[popup-open]:bg-fg/5 data-[popup-open]:text-fg focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
            className,
          )}
        >
          <SmileyPlus />
        </Popover.Trigger>
      )}
      <Popover.Portal>
        <Popover.Positioner side={side} align={align} sideOffset={6} collisionPadding={8} className="z-(--z-popover)">
          <Popover.Popup
            aria-label={label}
            className={cn(
              "max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-line-2 bg-raised shadow-pop outline-none",
              "transition-[opacity,scale] duration-180 ease-out-expo data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              "data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-120",
              "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
            )}
          >
            <EmojiPickerPanel
              {...panel}
              recent={recent}
              onRecentChange={setRecent}
              skinTone={tone}
              onSkinToneChange={setTone}
              onEmojiSelect={(p) => {
                onEmojiSelect?.(p);
                if (closeOnSelect) setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
