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
  ['16','Bolg of the North','rare','Legendary Creature — Orc Warrior','The Battle of Five Armies began.'],
  ['17','Sting, Bilbo\'s Sword','rare','Legendary Artifact — Equipment',''],
  ['18','My Precious','uncommon','Enchantment — Aura',''],
  ['19','Last Light of Durin\'s Day','rare','Enchantment','The thrush knocked.'],
  ['20','Silvan Reveler','common','Creature — Elf Citizen',''],
  // special art treatment: same name, collector number beyond the main set
  ['300','Bilbo, Fellow Conspirator','rare','Legendary Creature — Halfling Rogue','"I am a burglar, apparently."'],
];
const data = names.map(([cn, name, rarity, type_line, flavor]) => ({
  id: 'mock-' + cn,
  name, collector_number: cn, rarity, type_line,
  flavor_text: flavor,
  oracle_text: '',
  image_uris: null, // no images offline; site should show name placeholders
  scryfall_uri: 'https://scryfall.com/',
}));
module.exports = { object: 'list', total_cards: data.length, has_more: false, data };
