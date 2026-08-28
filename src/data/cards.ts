import type { Card, CardColor, Rarity } from '../types'

export interface CardSet {
  id: string
  name: string
  from: number
  to: number
}

export const SETS: CardSet[] = [
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

function setFor(number: number): CardSet {
  const found = SETS.find((s) => number >= s.from && number <= s.to)
  if (!found) throw new Error(`No set for card #${number}`)
  return found
}

/** Стабильный id по номеру — редкость/название можно менять без потери данных */
export function cardId(number: number): string {
  return `n${number}`
}

function card(
  number: number,
  name: string,
  rarity: Rarity,
  color: CardColor = 'blue',
  unknownName = false,
): Card {
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

function unnamed(number: number, rarity: Rarity, color: CardColor): Card {
  return card(number, 'Неизвестно', rarity, color, true)
}

/** Актуальный каталог альбома (по сетам) */
export const CARDS: Card[] = [
  // Shellshy Set (1–9)
  card(1, 'Water Shy', 1),
  card(2, 'Bottled Secret', 1),
  card(3, 'Sunny Shores', 1),
  card(4, 'Sneaky Flavors', 1),
  card(5, 'Fresh Fit', 1),
  card(6, 'Stray Ball', 1),
  card(7, 'Bold Entrance', 1),
  card(8, 'Leap of Faith', 1),
  card(9, 'Set Sail', 2),

  // Wobbler Set (10–18)
  card(10, 'Loading Wobbler', 1),
  card(11, 'Greet a Fan', 1),
  card(12, 'Glam Time', 1),
  card(13, 'Smells Like Fish', 1),
  card(14, 'Nice Catch', 1),
  card(15, 'Wobbler Wave', 1),
  card(16, 'Seaweed Mummy', 1),
  card(17, 'Big Bite', 2),
  card(18, 'Ride the Tide', 2),

  // Mudrump Set (19–27)
  card(19, 'Rolling Fun', 1),
  card(20, 'Capy Launch', 1),
  card(21, 'Friendly Gesture', 1),
  card(22, 'Sun Safe', 1),
  card(23, 'Beach Encounter', 1),
  card(24, 'Free Coconuts', 2),
  card(25, 'Mud Bath', 2),
  card(26, 'Solo Rock', 2),
  card(27, 'Fan Fervor', 2),

  // Sparkeet Set (28–36)
  card(28, 'Zip It', 1),
  card(29, 'Bottoms Up', 1),
  card(30, 'Power Vocalist', 1),
  card(31, 'Treasure Hunt', 1),
  card(32, 'Not a Fruit', 1),
  card(33, 'Run and Chase', 2),
  card(34, 'Sweet Gossip', 2),
  card(35, 'Poster Front', 2),
  card(36, 'Friends Unite', 3),

  // Sealing Set (37–45)
  card(37, "Let's Play", 1),
  card(38, 'Shiny Spot', 1),
  card(39, "Chill N' Float", 1),
  card(40, 'Shallow Waters', 1),
  card(41, 'Sleepy Sealoon', 2),
  card(42, 'Ball Expert', 2),
  card(43, 'Dream Ball', 2),
  card(44, 'Swirling Volley', 3),
  card(45, 'Endless Summer', 3),

  // Zaplet Set (46–54)
  card(46, 'Shadow Scare', 1),
  card(47, 'Gatecrasher', 1),
  card(48, 'Moon Dry', 1),
  card(49, 'Art Collection', 2),
  card(50, 'Shopping Trip', 2),
  card(51, 'Lord of Night', 2),
  card(52, 'Cake Time', 3),
  card(53, 'Paper Crafts', 3),
  card(54, 'Cozy Arms', 3),

  // Lollama Set (55–63)
  card(55, 'Downtime', 1),
  card(56, 'Party Trick', 1),
  card(57, 'Wax Head', 2),
  card(58, 'Kindred Spirits', 2),
  card(59, 'Beach Rush', 2),
  card(60, 'Palm Party', 3),
  card(61, 'Next Hit', 3),
  card(62, 'Blue Hour', 3),
  card(63, 'Lead Vocal', 4),

  // Lullely Set (64–72)
  card(64, 'Deep Dive', 1),
  card(65, 'Bubble Nap', 1),
  card(66, 'Loyal Fan', 2),
  card(67, 'All Flavors', 2),
  card(68, "Don't Droppit", 2),
  card(69, 'Ice Cream Tower', 3),
  card(70, 'Sudden Peril', 3),
  card(71, 'Deepsea Jewel', 4),
  unnamed(72, 4, 'gold'),

  // Blueflick Set (73–81)
  card(73, 'Cooling Dip', 1),
  card(74, 'Hide and Seek', 2),
  card(75, 'Firefly Night', 2),
  card(76, 'Cicada Spotted', 2),
  card(77, 'Lotus Effect', 3),
  card(78, 'Brilliant Blue', 3),
  card(79, 'Field Splash', 3),
  card(80, 'Noon Breeze', 4),
  unnamed(81, 4, 'gold'),

  // Gibber Set (82–90)
  card(82, 'Call of the Sea', 1),
  card(83, 'Swim Practice', 2),
  card(84, 'Melon March', 2),
  card(85, 'Tortoise and Hare', 3),
  card(86, 'Stranded Gibber', 3),
  card(87, 'Clear Skies', 3),
  unnamed(88, 4, 'gold'),
  unnamed(89, 4, 'blue'),
  card(90, 'Shell Shade', 5),

  // Shrimpyro Set (91–99)
  card(91, 'Daily Workout', 2),
  card(92, 'Durian Duty', 2),
  card(93, 'Reflex Training', 3),
  card(94, 'Power Serve', 3),
  card(95, 'Heavy Hit', 3),
  unnamed(96, 4, 'gold'),
  card(97, 'Gym Flex', 4),
  card(98, 'Shatter Strike', 4),
  unnamed(99, 5, 'gold'),

  // Gopher Set (100–108)
  card(100, 'Ace Pilot', 2),
  card(101, 'Sand Work', 2),
  card(102, 'Cave Life', 3),
  card(103, 'Grass Attack', 3),
  unnamed(104, 4, 'blue'),
  unnamed(105, 4, 'blue'),
  unnamed(106, 5, 'gold'),
  unnamed(107, 5, 'blue'),
  card(108, 'Sand Kingdom', 5, 'gold'),

  // Budboo Set (109–117)
  card(109, 'Tender Care', 2),
  card(110, 'Sweet Disguise', 3),
  unnamed(111, 4, 'gold'),
  unnamed(112, 4, 'blue'),
  unnamed(113, 5, 'gold'),
  unnamed(114, 4, 'blue'),
  card(115, 'Wrong Bud', 5),
  unnamed(116, 5, 'blue'),
  unnamed(117, 5, 'gold'),

  // Cribbler Set (118–126)
  card(118, 'Go Green', 3),
  card(119, 'Patched Dream', 3),
  card(120, 'Hot Sands', 4),
  card(121, 'Burger Clone', 4, 'gold'),
  unnamed(122, 4, 'blue'),
  card(123, 'Flex Off', 4, 'gold'),
  unnamed(124, 5, 'blue'),
  unnamed(125, 5, 'gold'),
  unnamed(126, 4, 'blue'),

  // Funglet Set (127–135)
  card(127, 'Mushroom Mishap', 3),
  card(128, 'Rain Cloud', 4),
  card(129, 'Summer Dream', 4),
  unnamed(130, 4, 'gold'),
  unnamed(131, 4, 'blue'),
  unnamed(132, 5, 'blue'),
  unnamed(133, 4, 'gold'),
  unnamed(134, 5, 'blue'),
  unnamed(135, 5, 'gold'),
]

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<
  string,
  Card
>

export const CARD_BY_NUMBER = Object.fromEntries(CARDS.map((c) => [c.number, c])) as Record<
  number,
  Card
>

/**
 * Достаёт номер карты из любого старого/нового id.
 * Поддерживает: n52, t3-52-blue, 52
 */
export function numberFromCardId(id: string): number | null {
  const nFormat = /^n(\d+)$/i.exec(id)
  if (nFormat) return Number(nFormat[1])

  const legacy = /^t\d+-(\d+)-(?:blue|gold)$/i.exec(id)
  if (legacy) return Number(legacy[1])

  const plain = /^(\d+)$/.exec(id)
  if (plain) return Number(plain[1])

  return null
}

/** Переводит любой id на стабильный n{number} */
export function migrateCardId(id: string): string | null {
  const num = numberFromCardId(id)
  if (num == null || !CARD_BY_NUMBER[num]) return null
  return cardId(num)
}

export function rarityLabel(rarity: Rarity): string {
  return '★'.repeat(rarity)
}
