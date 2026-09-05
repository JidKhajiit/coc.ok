export type CardTradeRarity = 1 | 2 | 3 | 4 | 5
export type CardTradeColor = 'blue' | 'gold'

export interface CardTradeSet {
  id: string
  name: string
  from: number
  to: number
}

export interface CardTradeCard {
  id: string
  name: string
  number: number
  rarity: CardTradeRarity
  color: CardTradeColor
  setId: string
  setName: string
  unknownName?: boolean
}

export interface CardTradeEventSeed {
  slug: string
  name: string
  startDate: string
  endDate: string
  active: boolean
  sets: CardTradeSet[]
  cards: CardTradeCard[]
}

export const SUMMER_PARTY_SETS: CardTradeSet[] = [
  { id: 'shellshy', name: 'Shellshy Set', from: 1, to: 9 },
  { id: 'wobbler', name: 'Wobbler Set', from: 10, to: 18 },
  { id: 'mudrump', name: 'Mudrump Set', from: 19, to: 27 },
  { id: 'sparkeet', name: 'Sparkeet Set', from: 28, to: 36 },
  { id: 'sealing', name: 'Sealing Set', from: 37, to: 45 },
  { id: 'zaplet', name: 'Zaplet Set', from: 46, to: 54 },
  { id: 'lollama', name: 'Lollama Set', from: 55, to: 63 },
  { id: 'lullely', name: 'Lullely Set', from: 64, to: 72 },
  { id: 'blueflick', name: 'Blueflick Set', from: 73, to: 81 },
  { id: 'gibber', name: 'Gibber Set', from: 82, to: 90 },
  { id: 'shrimpyro', name: 'Shrimpyro Set', from: 91, to: 99 },
  { id: 'gopher', name: 'Gopher Set', from: 100, to: 108 },
  { id: 'budboo', name: 'Budboo Set', from: 109, to: 117 },
  { id: 'cribbler', name: 'Cribbler Set', from: 118, to: 126 },
  { id: 'funglet', name: 'Funglet Set', from: 127, to: 135 },
]

function setFor(number: number): CardTradeSet {
  const found = SUMMER_PARTY_SETS.find((s) => number >= s.from && number <= s.to)
  if (!found) throw new Error(`No set for card #${number}`)
  return found
}

export function cardId(number: number): string {
  return `n${number}`
}

function card(
  number: number,
  name: string,
  rarity: CardTradeRarity,
  color: CardTradeColor = 'blue',
  unknownName = false,
): CardTradeCard {
  const set = setFor(number)
  return {
    id: cardId(number),
    number,
    name,
    rarity,
    color,
    setId: set.id,
    setName: set.name,
    ...(unknownName ? { unknownName: true } : {}),
  }
}

export const SUMMER_PARTY_CARDS: CardTradeCard[] = [
  card(1, 'Water Shy', 1),
  card(2, 'Bottled Secret', 1),
  card(3, 'Sunny Shores', 1),
  card(4, 'Sneaky Flavors', 1),
  card(5, 'Fresh Fit', 1),
  card(6, 'Stray Ball', 1),
  card(7, 'Bold Entrance', 1),
  card(8, 'Leap of Faith', 1),
  card(9, 'Set Sail', 2),

  card(10, 'Loading Wobbler', 1),
  card(11, 'Greet a Fan', 1),
  card(12, 'Glam Time', 1),
  card(13, 'Smells Like Fish', 1),
  card(14, 'Nice Catch', 1),
  card(15, 'Wobbler Wave', 1),
  card(16, 'Seaweed Mummy', 1),
  card(17, 'Big Bite', 2),
  card(18, 'Ride the Tide', 2),

  card(19, 'Rolling Fun', 1),
  card(20, 'Capy Launch', 1),
  card(21, 'Friendly Gesture', 1),
  card(22, 'Sun Safe', 1),
  card(23, 'Beach Encounter', 1),
  card(24, 'Free Coconuts', 2),
  card(25, 'Mud Bath', 2),
  card(26, 'Solo Rock', 2),
  card(27, 'Fan Fervor', 2),

  card(28, 'Zip It', 1),
  card(29, 'Bottoms Up', 1),
  card(30, 'Power Vocalist', 1),
  card(31, 'Treasure Hunt', 1),
  card(32, 'Not a Fruit', 1),
  card(33, 'Run and Chase', 2),
  card(34, 'Sweet Gossip', 2),
  card(35, 'Poster Front', 2),
  card(36, 'Friends Unite', 3),

  card(37, "Let's Play", 1),
  card(38, 'Shiny Spot', 1),
  card(39, "Chill N' Float", 1),
  card(40, 'Shallow Waters', 1),
  card(41, 'Sleepy Sealoon', 2),
  card(42, 'Ball Expert', 2),
  card(43, 'Dream Ball', 2),
  card(44, 'Swirling Volley', 3),
  card(45, 'Endless Summer', 3),

  card(46, 'Shadow Scare', 1),
  card(47, 'Gatecrasher', 1),
  card(48, 'Moon Dry', 1),
  card(49, 'Art Collection', 2),
  card(50, 'Shopping Trip', 2),
  card(51, 'Lord of Night', 2),
  card(52, 'Cake Time', 3),
  card(53, 'Paper Crafts', 3),
  card(54, 'Cozy Arms', 3),

  card(55, 'Downtime', 1),
  card(56, 'Party Trick', 1),
  card(57, 'Wax Head', 2),
  card(58, 'Kindred Spirits', 2),
  card(59, 'Beach Rush', 2),
  card(60, 'Palm Party', 3),
  card(61, 'Next Hit', 3),
  card(62, 'Blue Hour', 3),
  card(63, 'Lead Vocal', 4),

  card(64, 'Deep Dive', 1),
  card(65, 'Bubble Nap', 1),
  card(66, 'Loyal Fan', 2),
  card(67, 'All Flavors', 2),
  card(68, "Don't Droppit", 2),
  card(69, 'Ice Cream Tower', 3),
  card(70, 'Sudden Peril', 3),
  card(71, 'Deepsea Jewel', 4),
  card(72, 'Frug Fantasies', 4, 'gold'),

  card(73, 'Cooling Dip', 1),
  card(74, 'Hide and Seek', 2),
  card(75, 'Firefly Night', 2),
  card(76, 'Cicada Spotted', 2),
  card(77, 'Lotus Effect', 3),
  card(78, 'Brilliant Blue', 3),
  card(79, 'Field Splash', 3),
  card(80, 'Noon Breeze', 4),
  card(81, 'Frost Fun', 4, 'gold'),

  card(82, 'Call of the Sea', 1),
  card(83, 'Swim Practice', 2),
  card(84, 'Melon March', 2),
  card(85, 'Tortoise and Hare', 3),
  card(86, 'Stranded Gibber', 3),
  card(87, 'Clear Skies', 3),
  card(88, 'Tug of War', 4, 'gold'),
  card(89, 'Surprise Shower', 4, 'blue'),
  card(90, 'Shell Shade', 5),

  card(91, 'Daily Workout', 2),
  card(92, 'Durian Duty', 2),
  card(93, 'Reflex Training', 3),
  card(94, 'Power Serve', 3),
  card(95, 'Heavy Hit', 3),
  card(96, 'Jungle Prowl', 4, 'gold'),
  card(97, 'Gym Flex', 4),
  card(98, 'Shatter Strike', 4),
  card(99, 'A New Reign', 5, 'gold'),

  card(100, 'Ace Pilot', 2),
  card(101, 'Sand Work', 2),
  card(102, 'Cave Life', 3),
  card(103, 'Grass Attack', 3),
  card(104, 'Smashing Waves', 4, 'blue'),
  card(105, 'Gym Pics', 4, 'blue'),
  card(106, 'Blazing Beetle', 5, 'gold'),
  card(107, 'Shining Knight', 5, 'blue'),
  card(108, 'Sand Kingdom', 5, 'gold'),

  card(109, 'Tender Care', 2),
  card(110, 'Sweet Disguise', 3),
  card(111, 'Love-Struck', 4, 'gold'),
  card(112, 'The Duel', 4, 'blue'),
  card(113, 'Limelight', 5, 'gold'),
  card(114, 'Autumn Love', 4, 'blue'),
  card(115, 'Wrong Bud', 5),
  card(116, 'Tail Swipe', 5, 'blue'),
  card(117, 'Rockzilla Roar', 5, 'gold'),

  card(118, 'Go Green', 3),
  card(119, 'Patched Dream', 3),
  card(120, 'Hot Sands', 4),
  card(121, 'Burger Clone', 4, 'gold'),
  card(122, 'Sweet Dreams', 4, 'blue'),
  card(123, 'Flex Off', 4, 'gold'),
  card(124, 'Forever Fan', 5, 'blue'),
  card(125, 'Cozy Bed', 5, 'gold'),
  card(126, 'Fateful Save', 4, 'blue'),

  card(127, 'Mushroom Mishap', 3),
  card(128, 'Rain Cloud', 4),
  card(129, 'Summer Dream', 4),
  card(130, 'Burning Envy', 4, 'gold'),
  card(131, 'Scent Selection', 4, 'blue'),
  card(132, 'Frantic Flutter', 5, 'blue'),
  card(133, 'Rippling Dust', 4, 'gold'),
  card(134, 'Sneaky Nab', 5, 'blue'),
  card(135, 'Charring Waves', 5, 'gold'),
]

export const DEFAULT_CARD_TRADE_EVENT: CardTradeEventSeed = {
  slug: 'summer-party',
  name: 'Summer Party',
  startDate: '2026-09-03',
  endDate: '2026-10-07',
  active: true,
  sets: SUMMER_PARTY_SETS,
  cards: SUMMER_PARTY_CARDS,
}

export function rarityLabel(rarity: CardTradeRarity): string {
  return '★'.repeat(rarity)
}
