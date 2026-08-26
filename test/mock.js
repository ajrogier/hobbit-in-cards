// Mock Scryfall data for offline testing
const names = [
  ['1','Bilbo, Fellow Conspirator','rare','Legendary Creature — Halfling Rogue','"I am a burglar, apparently."'],
  ['2','Gandalf, Party Guest','mythic','Legendary Creature — Avatar Wizard',''],
  ['3','Thorin, King of Durin\'s Folk','mythic','Legendary Creature — Dwarf Noble',''],
  ['4','Hobbit Hole','common','Artifact — Fortification','In a hole in the ground there lived a hobbit.'],
  ['5','Roast Mutton','common','Sorcery','Three trolls argued over supper.'],
  ['6','Elrond of Rivendell','rare','Legendary Creature — Elf Noble',''],
  ['7','Great Goblin','uncommon','Creature — Goblin Noble','Under the Misty Mountains.'],
  ['8','Gollum, Riddle Master','mythic','Legendary Creature — Halfling Horror','"What has it got in its pocketses?"'],
  ['9','The Eagles Are Coming!','uncommon','Instant',''],
  ['10','Beorn, the Skin-Changer','rare','Legendary Creature — Human Bear',''],
  ['11','Mirkwood Spider','common','Creature — Spider','Attercop! Attercop!'],
  ['12','Thranduil, the Elvenking','rare','Legendary Creature — Elf Noble',''],
  ['13','Barrels Out of Bond','uncommon','Sorcery','Down the river to Lake-town.'],
  ['14','Smaug, the Magnificent','mythic','Legendary Creature — Dragon','Greatest of calamities.'],
  ['15','Bard, King of Dale','rare','Legendary Creature — Human Archer','The Black Arrow flew true.'],
  ['16','Bólg of the North','rare','Legendary Creature — Orc Warrior','The Battle of Five Armies began.'],
  ['17','Sting, Bilbo\'s Sword','rare','Legendary Artifact — Equipment',''],
  ['18','My Precious','uncommon','Enchantment — Aura',''],
  ['19','Last Light of Durin\'s Day','rare','Enchantment','The thrush knocked.'],
  ['20','Silvan Reveler','common','Creature — Elf Citizen',''],
  // special art treatment: same name, collector number beyond the main set
  ['300','Bilbo, Fellow Conspirator','rare','Legendary Creature — Halfling Rogue','"I am a burglar, apparently."'],
  ['301','Bilbo, Fellow Conspirator','rare','Legendary Creature — Halfling Rogue','"I am a burglar, apparently."'],
];
const artFor = cn => cn === '14'
  ? { normal: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680">' +
      '<rect width="488" height="680" fill="#7a2e1e"/><circle cx="244" cy="300" r="150" fill="#d0722e"/></svg>'),
      art_crop: 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="626" height="457">' +
      '<rect width="626" height="457" fill="#5a1e12"/><circle cx="313" cy="228" r="170" fill="#e0863e"/></svg>') }
  : null; // most cards keep placeholders; one real <img> exercises native-drag suppression
// Distinct Cardmarket product ids for the twin printings prove the buy list
// links each ART separately; #20 has none (name-search fallback path).
const cmIds = { '16': 700016, '300': 700300, '301': 700301 };
const data = names.map(([cn, name, rarity, type_line, flavor]) => ({
  id: 'mock-' + cn,
  name, collector_number: cn, rarity, type_line,
  set_name: 'The Hobbit',
  flavor_text: flavor,
  oracle_text: '',
  image_uris: artFor(cn),
  artist: cn === '300' ? 'Alan Lee' : cn === '301' ? 'John Howe' : '',
  cardmarket_id: cmIds[cn] || null,
  scryfall_uri: 'https://scryfall.com/',
}));
// Token companion set (thob): same collector numbers restart at 1
const tokens = [
  ['1','Dragon','common','Token Creature — Dragon',''],
  ['2','Spider','common','Token Creature — Spider','Attercop!'],
].map(([cn, name, rarity, type_line, flavor]) => ({
  id: 'tok-' + cn,
  name, collector_number: cn, rarity, type_line,
  set_name: 'The Hobbit Tokens',
  flavor_text: flavor,
  oracle_text: '',
  image_uris: null,
  // token: no product id, but Scryfall's own purchase link (middle fallback)
  purchase_uris: cn === '1' ? { cardmarket: 'https://www.cardmarket.com/en/Magic/Products/Search?searchString=Dragon+Token' } : undefined,
  scryfall_uri: 'https://scryfall.com/',
}));

module.exports = {
  object: 'list', total_cards: data.length, has_more: false, data,
  tokenResponse: { object: 'list', total_cards: tokens.length, has_more: false, data: tokens },
};
