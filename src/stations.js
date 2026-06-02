// Each: { city, stationLabel, icao, lat, lon, tz }
// tz is an IANA timezone, used to show each place's local time independently of
// the forecast API (so local time still works when the forecast is unavailable).
const RAW = [
  { city: 'Seoul', stationLabel: 'Incheon Intl Airport', icao: 'RKSI', lat: 37.469, lon: 126.451, tz: 'Asia/Seoul' },
  { city: 'Houston', stationLabel: 'William P. Hobby Airport', icao: 'KHOU', lat: 29.645, lon: -95.279, tz: 'America/Chicago' },
  { city: 'Chicago', stationLabel: "O'Hare Intl Airport", icao: 'KORD', lat: 41.978, lon: -87.904, tz: 'America/Chicago' },
  { city: 'Warsaw', stationLabel: 'Warsaw Chopin Airport', icao: 'EPWA', lat: 52.166, lon: 20.967, tz: 'Europe/Warsaw' },
  { city: 'Austin', stationLabel: 'Austin-Bergstrom Intl', icao: 'KAUS', lat: 30.194, lon: -97.670, tz: 'America/Chicago' },
  { city: 'London', stationLabel: 'London City Airport', icao: 'EGLC', lat: 51.505, lon: 0.055, tz: 'Europe/London' },
  { city: 'Shanghai', stationLabel: 'Pudong Intl Airport', icao: 'ZSPD', lat: 31.143, lon: 121.805, tz: 'Asia/Shanghai' },
  { city: 'Paris', stationLabel: 'Paris-Le Bourget Airport', icao: 'LFPB', lat: 48.969, lon: 2.441, tz: 'Europe/Paris' },
  { city: 'Beijing', stationLabel: 'Capital Intl Airport', icao: 'ZBAA', lat: 40.080, lon: 116.585, tz: 'Asia/Shanghai' },
  { city: 'Munich', stationLabel: 'Munich Airport', icao: 'EDDM', lat: 48.354, lon: 11.786, tz: 'Europe/Berlin' },
  { city: 'NYC', stationLabel: 'LaGuardia Airport', icao: 'KLGA', lat: 40.777, lon: -73.872, tz: 'America/New_York' },
  { city: 'Denver', stationLabel: 'Buckley Space Force Base', icao: 'KBKF', lat: 39.717, lon: -104.752, tz: 'America/Denver' },
  { city: 'Mexico City', stationLabel: 'Benito Juárez Intl', icao: 'MMMX', lat: 19.436, lon: -99.072, tz: 'America/Mexico_City' },
  { city: 'Miami', stationLabel: 'Miami Intl Airport', icao: 'KMIA', lat: 25.793, lon: -80.290, tz: 'America/New_York' },
  { city: 'Singapore', stationLabel: 'Changi Airport', icao: 'WSSS', lat: 1.359, lon: 103.989, tz: 'Asia/Singapore' },
  { city: 'Tokyo', stationLabel: 'Haneda Airport', icao: 'RJTT', lat: 35.552, lon: 139.780, tz: 'Asia/Tokyo' },
  // WU/Polymarket resolve "Shenzhen ZGSZ" on the Lau Fau Shan (HK) station, NOT the
  // airport. No public METAR there, so observations come from weather.com's own
  // history (wuLocationId) and the forecast from Lau Fau Shan's coords — matching
  // exactly what the market reads. Whole-°C region → reportsTenths:false.
  { city: 'Shenzhen', stationLabel: "Lau Fau Shan, HK (WU's 'Shenzhen')", icao: null, wuLocationId: 'ZGSZ:9:CN', lat: 22.469, lon: 113.983, tz: 'Asia/Hong_Kong', reportsTenths: false },
  { city: 'Amsterdam', stationLabel: 'Schiphol Airport', icao: 'EHAM', lat: 52.309, lon: 4.764, tz: 'Europe/Amsterdam' },
  { city: 'Wellington', stationLabel: 'Wellington Intl Airport', icao: 'NZWN', lat: -41.327, lon: 174.805, tz: 'Pacific/Auckland' },
  { city: 'Madrid', stationLabel: 'Adolfo Suárez Barajas', icao: 'LEMD', lat: 40.472, lon: -3.561, tz: 'Europe/Madrid' },
  { city: 'Taipei', stationLabel: 'Songshan Airport', icao: 'RCSS', lat: 25.069, lon: 121.552, tz: 'Asia/Taipei' },
  { city: 'Lucknow', stationLabel: 'Chaudhary Charan Singh Intl', icao: 'VILK', lat: 26.761, lon: 80.889, tz: 'Asia/Kolkata' },
  { city: 'Milan', stationLabel: 'Malpensa Intl Airport', icao: 'LIMC', lat: 45.630, lon: 8.728, tz: 'Europe/Rome' },
  { city: 'Manila', stationLabel: 'Ninoy Aquino Intl', icao: 'RPLL', lat: 14.509, lon: 121.020, tz: 'Asia/Manila' },
  { city: 'Kuala Lumpur', stationLabel: 'KL Intl Airport', icao: 'WMKK', lat: 2.746, lon: 101.710, tz: 'Asia/Kuala_Lumpur' },
  { city: 'Jeddah', stationLabel: 'King Abdulaziz Intl', icao: 'OEJN', lat: 21.680, lon: 39.157, tz: 'Asia/Riyadh' },
  { city: 'Helsinki', stationLabel: 'Helsinki-Vantaa Airport', icao: 'EFHK', lat: 60.317, lon: 24.963, tz: 'Europe/Helsinki' },
  { city: 'Wuhan', stationLabel: 'Tianhe Intl Airport', icao: 'ZHHH', lat: 30.784, lon: 114.208, tz: 'Asia/Shanghai' },
  { city: 'Seattle', stationLabel: 'Seattle-Tacoma Intl', icao: 'KSEA', lat: 47.450, lon: -122.309, tz: 'America/Los_Angeles' },
  { city: 'Ankara', stationLabel: 'Esenboğa Intl Airport', icao: 'LTAC', lat: 40.128, lon: 32.995, tz: 'Europe/Istanbul' },
  { city: 'Atlanta', stationLabel: 'Hartsfield-Jackson Intl', icao: 'KATL', lat: 33.640, lon: -84.427, tz: 'America/New_York' },
  { city: 'Chengdu', stationLabel: 'Shuangliu Intl Airport', icao: 'ZUUU', lat: 30.578, lon: 103.947, tz: 'Asia/Shanghai' },
  { city: 'Chongqing', stationLabel: 'Jiangbei Intl Airport', icao: 'ZUCK', lat: 29.719, lon: 106.642, tz: 'Asia/Shanghai' },
  { city: 'Los Angeles', stationLabel: 'Los Angeles Intl', icao: 'KLAX', lat: 33.942, lon: -118.408, tz: 'America/Los_Angeles' },
  { city: 'Sao Paulo', stationLabel: 'Guarulhos Intl Airport', icao: 'SBGR', lat: -23.435, lon: -46.473, tz: 'America/Sao_Paulo' },
  { city: 'Busan', stationLabel: 'Gimhae Intl Airport', icao: 'RKPK', lat: 35.180, lon: 128.938, tz: 'Asia/Seoul' },
  { city: 'Istanbul', stationLabel: 'Istanbul Airport', icao: 'LTFM', lat: 41.262, lon: 28.742, tz: 'Europe/Istanbul', resolveNote: "Wunderground had no data under LTFM — verify which station its market uses before bidding." },
  { city: 'San Francisco', stationLabel: 'San Francisco Intl', icao: 'KSFO', lat: 37.619, lon: -122.375, tz: 'America/Los_Angeles' },
  { city: 'Moscow', stationLabel: 'Vnukovo Intl Airport', icao: 'UUWW', lat: 55.591, lon: 37.261, tz: 'Europe/Moscow' },
  { city: 'Tel Aviv', stationLabel: 'Ben Gurion Intl', icao: 'LLBG', lat: 32.011, lon: 34.887, tz: 'Asia/Jerusalem' },
  { city: 'Dallas', stationLabel: 'Dallas Love Field', icao: 'KDAL', lat: 32.847, lon: -96.852, tz: 'America/Chicago' },
  { city: 'Guangzhou', stationLabel: 'Baiyun Intl Airport', icao: 'ZGGG', lat: 23.392, lon: 113.299, tz: 'Asia/Shanghai' },
  { city: 'Panama City', stationLabel: 'Marcos A. Gelabert Intl', icao: 'MPMG', lat: 8.973, lon: -79.556, tz: 'America/Panama' },
  { city: 'Qingdao', stationLabel: 'Jiaodong Intl Airport', icao: 'ZSQD', lat: 36.366, lon: 120.086, tz: 'Asia/Shanghai' },
  { city: 'Cape Town', stationLabel: 'Cape Town Intl Airport', icao: 'FACT', lat: -33.969, lon: 18.597, tz: 'Africa/Johannesburg' },
  { city: 'Toronto', stationLabel: 'Pearson Intl Airport', icao: 'CYYZ', lat: 43.677, lon: -79.631, tz: 'America/Toronto' },
]

// weather.com place IDs for direct links to each city's weather page.
// Fetched via api.weather.com/v3/location/search, nearest result to the station coords.
const WC_ID = {
  'Seoul':         'bcf9c3c268f09aa5353d6d374302bd3c826ea47577a25f549d7e8997f6e6da45',
  'Houston':       'da00666b99e29819289c87a0c1e7c4813ce274131a5131564adbb59caf76fcfe',
  'Chicago':       '4c9ff75840c6ce23fa10812d0f14b605af47896e9ca3fd59abdb9edd1b9d486a',
  'Warsaw':        'c40c3d36ef5e02c7bfb64f4f9dde3c3783248c911f7cc83bf1345d4907336463',
  'Austin':        '05a7e7f73567bcc0ce8fac95250c4a0b26580d12fa0797e832d875d46ed01a30',
  'London':        'c4d57ff998340aa98eefa095c4ace4f0c16d6e7a611987ce8306ae218901bde8',
  'Shanghai':      '4bb49c3c2c97f9382266e4d40650e30ee931d0227e19947ffc456deab0db58d7',
  'Paris':         'a51759b4cb9d79ec1bc8eb878d0fb28302bd9f188b1b74e5058fb624da38972f',
  'Beijing':       '00c189c38a25908eae6f4246e0d4648890e75239d4331f4517f1fc38e920ff05',
  'Munich':        '2ae7ecb6f439b44e6807aab6a7a2147f8e8f44b093b27811e3bfeef217c0f545',
  'NYC':           '98e8083bb7de0fc467fd1e22a1692f8f200343e4e0acc3b3fc31e71d29113b54',
  'Denver':        'bc90e5a2d81f4c263abbedec7ffd894f551d32af01721add6a9674775cb53290',
  'Mexico City':   '279b9b5f79fa02ab0d2133430d64bbb06bb53ae0fdf3234ea59d68dba44812cb',
  'Miami':         'e1047ad568844fbc0c805862a1121cc54df470b43dea921324a8a416800c80bd',
  'Singapore':     '257f8f1ef4417e1fad9e0acf486ebc0089cca970fc1ae5f2dcb94edcc7f3343d',
  'Tokyo':         '758faa85353c59e96478e0efad4a5d84cae12f9f1ffe766e89b1a1bc862bcae5',
  'Shenzhen':      '1670890a44c4bb7d7d66e47d0e79a8bfea1474ab51e9dd771062ab4a959e0c8a',
  'Amsterdam':     '693d7de83d581b56c79ecf10852d8448e7f11d1c227aec3151711f4235621146',
  'Wellington':    '983c944bd68aacab241da94b44727a735059f35266958076099e5f7a269e6907',
  'Madrid':        'f620d7fe58f453124aa71caa578d94f09a298b74f2e9bd519413ad3d9ce6a771',
  'Taipei':        'ce745664a88b5afafeb9b67d548ae1f5cfbcc2631f3cb119d921b2c8ca7a20be',
  'Lucknow':       'c4106938d2a6c71cb0bc70f47dbc2ae4e6281edeafb905513deff573777b7273',
  'Milan':         '5b91016228ef489c0612cbe79c0bd55a519a34b7ad5559c21b89c6274c90b234',
  'Manila':        '49954a1d21975988f6495822ffe48ed125068eb80d2a22b37ad66e61603de5b2',
  'Kuala Lumpur':  '1aa2f86c9dcbfed12b42ee4b09de45e16ea5add96aa7fce993cfee0aaef4704f',
  'Jeddah':        '1f09bc6f2a6b4fc0b0b4fb6b986a6df40d2299ec70eeed1beec26180f4bc1c90',
  'Helsinki':      '9b06c40b9b0e7241268950fb8d6ed505bb722661c512fed7b87b5490298a4721',
  'Wuhan':         'd4ec60c772d63a6a153e3c9f7cb23fea713f0a89acb4209f01c5f27b134427d7',
  'Seattle':       '0e671a013769a86a69535aacb59b4c5fe0d4c9ea059a089d346d96d2bb64b689',
  'Ankara':        '7f6d21f7b08cf5eb15d1371590e895e74304f3972a925eacf3fc914bec2c7464',
  'Atlanta':       '56b7542e165bf857eec959a92d69c1846c0a020afcc4a735b5209cc136093d19',
  'Chengdu':       '2c6ad02c957ba52818d01fa1165baf952213d059af873cba4b26c788d5abd5b9',
  'Chongqing':     '071e5f87a5828618770515bc44d4f282801cbe68d0617921b6b701034a458d65',
  'Los Angeles':   '4facbbbb39938d43bf8e8f58a2f32dc61b6fd97d57c89ed8fd3ecbd8079003da',
  'Sao Paulo':     'fc23f70a4b3637352b24d1c991bc6f9e82ddbc9c466a74e44e77eef75d9201f9',
  'Busan':         '147a4520bcd15c101b606489aad9fabc0c13d9690ce58881199b0a7af122b678',
  'Istanbul':      '80b7ab0e85646330a87786cb3b580a5c6a7611d99835fa3483339213a7f74071',
  'San Francisco': 'f4d665b1a9b25d421618b492fad7a04da6c042efe647414e56c07e675c1e4b65',
  'Moscow':        '7cdd1c6b2d4a01558f272bd111d7cca3b9048744cf5efd2d81fb22ba73501509',
  'Tel Aviv':      'e4fa685899653908b7d559e66cfae203d9fa66c56cd3244702251941aeabf805',
  'Dallas':        '92326a47beaf3d8ba25af6f649873f08a0ebd47e2cd8b55187177a2174590e8d',
  'Guangzhou':     '7fb65b35aa8e4da04c8988e24c8590cc2d61ab76b1a7a0bdb99c38e5d0a583a4',
  'Panama City':   'edd7ddc0cc06461005673658b79a7be922318797d7f25d541cf6a2dc6a725081',
  'Qingdao':       'ebcfb1ee3ef0052271d6bb78b2f7184fa407cff9d130b4bdc5dd350da9b15451',
  'Cape Town':     '2337ef7978c41e935d59c4aa945b5b5b6bb69a6107de9545e675d392c6f2a675',
  'Toronto':       'b7336def86611c33dd6c1c04d682625cfe24acf572c7227b47a63d346661c06e',
}

// ISO-2 country per ICAO, used to build each station's Wunderground station code
// ("ICAO:9:CC"). Reading the per-hour WU value through this code matches what the
// WU website (and Polymarket) resolve on — WU's by-lat/lon path can round the same
// station's temps ~1° differently (verified: Lau Fau Shan code=29 vs geocode=30).
const WU_CC = {
  RKSI: 'KR', KHOU: 'US', KORD: 'US', EPWA: 'PL', KAUS: 'US', EGLC: 'GB', ZSPD: 'CN',
  LFPB: 'FR', ZBAA: 'CN', EDDM: 'DE', KLGA: 'US', KBKF: 'US', MMMX: 'MX', KMIA: 'US',
  WSSS: 'SG', RJTT: 'JP', EHAM: 'NL', NZWN: 'NZ', LEMD: 'ES', RCSS: 'TW', VILK: 'IN',
  LIMC: 'IT', RPLL: 'PH', WMKK: 'MY', OEJN: 'SA', EFHK: 'FI', ZHHH: 'CN', KSEA: 'US',
  LTAC: 'TR', KATL: 'US', ZUUU: 'CN', ZUCK: 'CN', KLAX: 'US', SBGR: 'BR', RKPK: 'KR',
  LTFM: 'TR', KSFO: 'US', UUWW: 'RU', LLBG: 'IL', KDAL: 'US', ZGGG: 'CN', MPMG: 'PA',
  ZSQD: 'CN', FACT: 'ZA', CYYZ: 'CA',
}

// wuCode: the WU station code each hourly card reads its "WU" value through.
// Shenzhen keeps its explicit resolution station (wuLocationId); the rest derive
// "ICAO:9:CC" from their airport code.
export const STATIONS = RAW.map((s) => ({
  ...s,
  wuCode: s.wuLocationId ?? (s.icao && WU_CC[s.icao] ? `${s.icao}:9:${WU_CC[s.icao]}` : null),
  wcId: WC_ID[s.city] ?? null,
}))
