// FICTIONAL restaurant data for owner manual testing: "Harbor Lane Bistro" (not a real business).
// Shapes match what the BOH publishes to boh_shared (menu, staff_clock, tables, bar, wines, guests).
// Every name, price, PIN and table below is invented for testing.
export const RESTAURANT = 'Harbor Lane Bistro (TEST)';

const opt = (id, name, up = 0, allergens, extra = {}) => Object.assign({id, name, up}, allergens ? {allergens, verified: true} : {}, extra);
const modGroups = [
  {id: 'mg_meat_temp', name: 'Meat Temperature', required: true, multi: false, options: [opt('mo_r', 'Rare'), opt('mo_mr', 'Medium Rare'), opt('mo_m', 'Medium'), opt('mo_mw', 'Medium Well'), opt('mo_wd', 'Well Done')]},
  {id: 'mg_fish_temp', name: 'Fish Temperature', required: true, multi: false, options: [opt('mo_f_mr', 'Medium Rare'), opt('mo_f_m', 'Medium'), opt('mo_f_wd', 'Cooked Through')]},
  {id: 'mg_side', name: 'Side Options', required: false, multi: false, options: [opt('mo_s_fries', 'Fries', 0, ['Gluten']), opt('mo_s_salad', 'Side Salad', 0, []), opt('mo_s_veg', 'Seasonal Vegetables', 0, [])]},
  {id: 'mg_add', name: 'Add-ons', required: false, multi: true, options: [opt('mo_a_cheese', 'Aged Cheddar', 1.5, ['Dairy']), opt('mo_a_bacon', 'Smoked Bacon', 2, ['Pork']), opt('mo_a_avo', 'Avocado', 2.5, []), opt('mo_a_egg', 'Fried Egg', 2, ['Egg'])]},
  {id: 'mg_drs', name: 'Dressing', required: false, multi: false, options: [opt('mo_d_lemon', 'Lemon Vinaigrette', 0, []), opt('mo_d_ranch', 'Buttermilk Ranch', 0, ['Dairy', 'Egg']), opt('mo_d_none', 'No Dressing', 0, [])]},
  {id: 'mg_garnish', name: 'Salad Garnish', required: false, multi: true, options: [opt('mo_g_pecan', 'Candied Pecans', 1, ['Tree Nut']), opt('mo_g_almond', 'Toasted Almonds', 1, ['Tree Nut']), opt('mo_g_seed', 'Pumpkin Seeds', 1, [])]},
  {id: 'mg_prep', name: 'Prep Notes', required: false, multi: true, options: [opt('mo_p_salt', 'No Salt'), opt('mo_p_side', 'Sauce on the Side'), opt('mo_p_gf', 'Gluten-Free Bread +$2', 2)]},
  {id: 'mg_dup_a', name: 'Preparation', required: true, multi: false, options: [opt('mo_x_grill', 'Grilled', 0), opt('mo_x_blacken', 'Blackened', 1)]},
  {id: 'mg_dup_b', name: 'Preparation', required: true, multi: false, options: [opt('mo_x_rice', 'Over Rice', 0), opt('mo_x_greens', 'Over Greens', 2)]}
];
const item = (id, code, name, desc, price, catIds, station, allergens, verified, modGroupIds = [], extra = {}) =>
  Object.assign({id, code, name, desc, price, cost: Math.round(price * 30) / 100, catIds, cookMin: 10, station, ingredients: desc.toLowerCase(), allergens, diet: [], verified, modGroupIds, taxIds: ['tx_test'], active: true}, extra);
const items = [
  item('hl1', '101', 'Crispy Calamari', 'Lemon aioli, pickled chili.', 16, ['c_small'], 'Fry', ['Shellfish', 'Gluten', 'Egg'], true, ['mg_prep']),
  item('hl2', '102', 'Burrata & Heirloom Tomato', 'Basil oil, sea salt, grilled bread.', 15, ['c_small'], 'Cold', ['Dairy', 'Gluten'], true, ['mg_prep']),
  item('hl3', '103', 'Tuna Crudo', 'Citrus soy, radish, sesame.', 18, ['c_small'], 'Cold', ['Fish', 'Soy', 'Sesame'], true, ['mg_prep']),
  item('hl4', '104', 'Oysters on the Half Shell (86 test)', 'Half dozen, mignonette. Marked 86 / not available.', 21, ['c_small'], 'Raw Bar', ['Shellfish'], true, [], {available: false}),
  item('hl5', '201', 'Roasted Tomato Soup', 'Cream, basil, croutons.', 11, ['c_soup'], 'Sauté', ['Dairy', 'Gluten'], true, []),
  item('hl6', '202', 'Market Greens Salad', 'Shaved fennel, citrus, choice of garnish.', 13, ['c_soup'], 'Cold', ['Mustard'], true, ['mg_drs', 'mg_garnish']),
  item('hl7', '301', 'Harbor Burger', 'Dry-aged beef, brioche, house pickles. Allergens NOT verified (test).', 22, ['c_ent'], 'Grill', ['Gluten', 'Dairy', 'Sesame'], false, ['mg_meat_temp', 'mg_side', 'mg_add']),
  item('hl8', '302', 'Grilled Ribeye 14 oz', 'Herb butter, roasted garlic. Allergens unknown (test).', 46, ['c_ent'], 'Grill', [], false, ['mg_meat_temp', 'mg_side']),
  item('hl9', '303', 'Pan-Seared Salmon', 'Lemon butter, capers, seasonal vegetables.', 32, ['c_ent'], 'Sauté', ['Fish', 'Dairy'], true, ['mg_fish_temp', 'mg_side']),
  item('hl10', '304', 'Wild Mushroom Risotto', 'Parmesan, thyme, truffle oil.', 26, ['c_ent'], 'Sauté', ['Dairy'], true, ['mg_add']),
  item('hl11', '305', 'Catch of the Day', 'Two required choices with the SAME name (modifier-identity test).', 30, ['c_ent'], 'Sauté', ['Fish'], true, ['mg_dup_a', 'mg_dup_b']),
  item('hl12', '401', 'Truffle Fries', 'Parmesan, chives.', 9, ['c_side'], 'Fry', ['Dairy'], true, []),
  item('hl13', '402', 'Charred Broccolini', 'Chili, garlic. Allergens unknown (test).', 8, ['c_side'], 'Sauté', [], false, []),
  item('hl14', '501', 'Dark Chocolate Tart', 'Sea salt caramel, whipped cream.', 12, ['c_des'], 'Pastry', ['Egg', 'Dairy', 'Soy', 'Gluten'], true, []),
  item('hl15', '502', 'Lemon Olive Oil Cake', 'Berries, mascarpone.', 11, ['c_des'], 'Pastry', ['Egg', 'Gluten', 'Dairy'], true, []),
  item('hl16', '503', 'Seasonal Sorbet', 'Ask for flavors.', 9, ['c_des'], 'Pastry', [], true, []),
  item('hl17', '601', 'Kids Buttered Pasta', 'Parmesan on the side.', 10, ['c_kid'], 'Sauté', ['Gluten', 'Dairy'], true, [])
];
const cats = [
  {id: 'c_small', name: 'Small Plates', visible: true}, {id: 'c_soup', name: 'Soups & Salads', visible: true},
  {id: 'c_ent', name: 'Entrées', visible: true}, {id: 'c_side', name: 'Sides', visible: true},
  {id: 'c_des', name: 'Desserts', visible: true}, {id: 'c_kid', name: 'Kids', visible: true},
  {id: 'c_wine_glass', name: 'Wine by the glass', visible: true, kind: 'wine'}, {id: 'c_wine_bottle', name: 'Wine by the bottle', visible: true, kind: 'wine'}
];
const job = {fm: {code: 'Food Master', access: 'POS', rate: 18}, sv: {code: 'Server', access: 'Order Only', rate: 16}, mg: {code: 'Manager', access: 'Full', rate: 30}, kt: {code: 'Kitchen', access: 'No Access', rate: 17}};
const person = (id, name, code, j) => ({id, name, code, wage: j.rate, enrolled: false, perms: null, jobs: [j], rates: [{id: 'r_' + id, effective: 1767225600000, rate: j.rate, reason: 'Test setup', modified: 1767225600000}], contact: {address: '', city: '', state: '', zip: '', phone: '', email: '', emName: '', emPhone: ''}, dependents: [], notes: [], reviews: [], sales: {}, status: 'active', hired: 1767225600000});
export const STAFF = [
  person('hs1', 'Jordan Reyes', '3101', job.fm), person('hs2', 'Sam Patel', '3102', job.fm),
  person('hs3', 'Casey Morgan', '4101', job.sv), person('hs4', 'Taylor Brooks', '5101', job.mg), person('hs5', 'Riley Chen', '1101', job.kt)
];
const t = (id, num, seats, shape, x, y, w = 80, h = 80, type = 'table') => ({id, type, shape, num, seats, x, y, w, h, status: 'open', server: ''});
const tables = {
  rooms: [{id: 'main', name: 'Main Dining'}, {id: 'bar', name: 'Bar'}, {id: 'patio', name: 'Patio'}],
  roomObjs: {
    main: [t('t1', 1, 2, 'round', 80, 80, 70, 70), t('t2', 2, 2, 'round', 220, 80, 70, 70), t('t3', 3, 4, 'square', 360, 80), t('t4', 4, 4, 'square', 500, 80),
      t('t5', 5, 6, 'round', 660, 80, 96, 96), t('t6', 6, 4, 'square', 80, 240), t('t7', 7, 4, 'square', 220, 240), t('t8', 8, 4, 'round', 360, 240),
      t('t9', 9, 8, 'rect', 500, 240, 150, 80), t('t10', 10, 4, 'round', 80, 400), t('t11', 11, 4, 'round', 220, 400), t('t12', 12, 2, 'round', 360, 400, 70, 70),
      {id: 'w1', type: 'wall', x: 40, y: 40, w: 760, h: 12, label: ''}, {id: 'h1', type: 'host', x: 700, y: 400, w: 70, h: 44, label: 'Host'}],
    bar: [{id: 'bar1', type: 'bar', x: 120, y: 120, w: 360, h: 80, label: 'Bar Counter'},
      ...['B1', 'B2', 'B3', 'B4'].map((n, i) => ({id: 'st' + (i + 1), type: 'stool', num: n, seats: 1, x: 140 + i * 70, y: 230, w: 40, h: 40, status: 'open', server: ''}))],
    patio: [{id: 'o1', type: 'outdoor', num: 'P1', seats: 2, x: 100, y: 100, w: 70, h: 70, status: 'open', server: ''}, {id: 'o2', type: 'outdoor', num: 'P2', seats: 4, x: 220, y: 100, w: 80, h: 80, status: 'open', server: ''}]
  },
  stations: [
    {id: 'hst1', number: 1, name: 'Station 1', room: 'main', tableIds: ['1', '2', '3', '4', '5', '6'], server: 'Jordan Reyes', serverCode: '3101'},
    {id: 'hst2', number: 2, name: 'Station 2', room: 'main', tableIds: ['7', '8', '9', '10', '11', '12'], server: 'Sam Patel', serverCode: '3102'}
  ],
  updatedAt: 1767225600000
};
const bar = (id, kind, name, desc, price, allergens = [], extra = {}) => Object.assign({id, code: '', kind, name, desc, price, cost: 0, stock: 24, unit: 'each', allergens, active: true}, extra);
const barList = [
  bar('hb1', 'Cocktail', 'Harbor Spritz', 'Bitter orange aperitivo, sparkling wine, soda.', 14, ['Sulfites']),
  bar('hb2', 'Cocktail', 'Lane Old Fashioned', 'Rye, demerara, orange bitters.', 16),
  bar('hb3', 'Cocktail', 'Garden Gimlet', 'Gin, lime, basil.', 15),
  bar('hb4', 'Cocktail', 'Sunset Sour', 'Rum, passion fruit, lime, egg white.', 15, ['Egg']),
  bar('hb5', 'Beer', 'Pier 9 Pilsner (fictional)', 'Draft lager.', 8, ['Gluten'], {unit: 'glass'}),
  bar('hb6', 'Beer', 'Lighthouse IPA (fictional)', 'Draft IPA.', 9, ['Gluten'], {unit: 'glass'}),
  bar('hb7', 'Spirit', 'Old Dock Bourbon (fictional)', 'Kentucky-style bourbon.', 13, [], {unit: 'pour'}),
  bar('hb8', 'Spirit', 'Coastline Single Malt (fictional)', 'Highland-style whisky.', 18, [], {unit: 'pour'}),
  bar('hb9', 'Mocktail', 'Cucumber Cooler', 'Cucumber, mint, lime, soda.', 8),
  bar('hb10', 'Coffee', 'Espresso', 'Double shot.', 4)
];
const wine = (id, vin, name, vintage, region, bottlePrice, glassPrice) => ({id, vin, name, vintage, region, bottlePrice, glassPrice, stock: 12, bottleOz: 25, ozOnHand: 300, openOz: 0, size: '750ml', active: true, producer: 'Fictional Estate', varietal: ''});
const wines = [
  wine('hw1', '9101', 'Seaglass Brut (fictional)', 'NV', 'Coastal Valley', 64, 14), wine('hw2', '9102', 'Driftwood Sauvignon Blanc (fictional)', '2023', 'North Ridge', 52, 13),
  wine('hw3', '9103', 'Tidewater Chardonnay (fictional)', '2022', 'Harbor Hills', 68, 15), wine('hw4', '9104', 'Lantern Pinot Noir (fictional)', '2021', 'Fog Valley', 78, 17),
  wine('hw5', '9105', 'Breakwater Cabernet (fictional)', '2019', 'Stone Bench', 120, 0), wine('hw6', '9106', 'Moonrise Late Harvest (fictional)', '2020', 'Coastal Valley', 58, 12)
];
// The complete fictional cloud: exactly the documents a BOH publish produces for the POS.
export function fictionalCloud() {
  const now = 1767225600000;
  return {
    boh_shared: {
      menu: {cats, items, modGroups, taxRates: [{id: 'tx_test', name: 'Test Sales Tax', rate: 8.875, isDefault: true}], books: [], updatedAt: now},
      menu_photos: {urls: {}, updatedAt: now},
      staff_clock: {list: STAFF, updatedAt: now},
      tables,
      bar: {list: barList, updatedAt: now},
      wines: {list: wines, chunkCount: 1, cellarVer: 'fictional-test-v1', updatedAt: now},
      guests: {list: [{id: 'hg1', name: 'Alex Rivera (fictional)', phone: '555-0100', notes: 'Regular. Prefers table 5. Shellfish allergy.'}], updatedAt: now},
      daily_specials: {list: [], updatedAt: now}
    }
  };
}
