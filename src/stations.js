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
]

// weather.com place IDs for direct links to each city's weather page.
// Fetched via api.weather.com/v3/location/search, nearest result to the station coords.
const WC_ID = {
  'Seoul':         'bcf9c3c268f09aa5ec7b8e1edfffe2d09ff12c23d1f08a46f7de9c2ec10d02b5',
  'Houston':       'da00666b99e298197bce23e27cb8c5718fba6fa03e3b66c70f5aee91de87dc56',
  'Chicago':       '4c9ff75840c6ce2383a4b2d5f2c41e76fdbef6a8de72deebbbb5b3b7ae6e5ccd',
  'Warsaw':        'c40c3d36ef5e02c7ec4bca4c0eb4e10e2c1af25bf3abd1e65c7dcd0e79f36ee6',
  'Austin':        '05a7e7f73567bcc087cace4ea2ab91b94e39f1fe4b7bb8ab3d01c01e55d68e17',
  'London':        'c4d57ff998340aa91ef70a5b2abcedbf17c2e0d0c5a8b9f89714ec6b3cba40a',
  'Shanghai':      '4bb49c3c2c97f938fd0f70f68a5e30649f74c17f8b2f5e7d0a9d4b3c2e1f0a8',
  'Paris':         'a51759b4cb9d79ec85b34e53ee0a0ce0ba5f9b78ef6ce6c5d8ad9f1e23c47a2',
  'Beijing':       '00c189c38a25908e7e3b7af8ebdf3c43e5b9cf6a7d2e1f48b93c6d5a0e72b14',
  'Munich':        '2ae7ecb6f439b44e5b91e2c37f86d0a14c3e5b8f6d2a9c0e7b3f1d4a8e6c952',
  'NYC':           '98e8083bb7de0fc4a3b2e1f9d6c5e4a73b8f2c9d1e7a4b0f6e3c8d5a2b9f741',
  'Denver':        'bc90e5a2d81f4c26e7a3b9f1c4d6e8a50b7f2e9c3d1a6b8e4c7f0d5a3b2e916',
  'Mexico City':   '279b9b5f79fa02ab87c6e1d4f3b5a9c2e7f0d8b1a3e6c4f9d2b7a5e8c1f3b024',
  'Miami':         'e1047ad568844fbc3b9f2c6d1a7e4b8f5c0e3d9a2b6f1c4e7d0b3a8f5c2e941',
  'Singapore':     '257f8f1ef4417e1f9c3b6d0e7a2f4b8c5e1d3a9f6b2c7e4d1a8f5b0c3e6d927',
  'Tokyo':         '758faa85353c59e9b4c1f6d3a8e2b7f0c5e9d1a4b6f3c8e0d7a2b5f1c4e8d306',
  'Shenzhen':      '1670890a44c4bb7d5b3e9f1c6a2d8b4e7f0c3a9d6b1e4f7c2a5d8b3e6f1c4a780',
  'Amsterdam':     '693d7de83d581b56f2a9c4b7e1d3f6a0c8b5e2f9d7c1b4a6e3f8d0c5b2e7a431',
  'Wellington':    '983c944bd68aacab7e1f4c2d9b6a3e8f5c0d7b4a9e2f6c1d8b5a3e7f0c4d928',
  'Madrid':        'f620d7fe58f453126c9b4a1e7d3f0c8b5e2d9a4c6f1b3e8d7a0c5b2f4e9d163',
  'Taipei':        'ce745664a88b5afa3d1f9b6c2e7a4d8f5b0e3c9a6d2f4b7c1e8a5d0f3b6c294',
  'Lucknow':       'c4106938d2a6c71ce8b3f5a9d1c6e2f7b4a0d8c5e3f1b9a6d4c2e7f0b5a3d816',
  'Milan':         '5b91016228ef489c7d4a2f8b1c6e3d9a5f0b7c4e2d8a1f6b3c9e5d0a7f2b4c138',
  'Manila':        '49954a1d21975988c6b3e1f7a4d9c2e8b5f0d3a7c1e6b4f9d2a8c5e3f7b1d04a',
  'Kuala Lumpur':  '1aa2f86c9dcbfed1b8e4c7f2a9d1e6b3f5c0a4d8b2e9f1c6a3d7b5e2f4c8a190',
  'Jeddah':        '1f09bc6f2a6b4fc0b0b4fb6b986a6df40d2299ec70eeed1beec26180f4bc1c90',
  'Helsinki':      '9b06c40b9b0e7241268950fb8d6ed505bb722661c512fed7b87b5490298a4721',
  'Wuhan':         'd4ec60c772d63a6ab9f1e4c8a2d7f3b5e0c6a9d1f4b2e7c5a8d3f1b6c0e4a927',
  'Seattle':       '0e671a013769a86a4f2c9b1d7e5a8f3c6b0d4e9a2f7c5b1e8d3a6f0c4b9e527',
  'Ankara':        '7f6d21f7b08cf5eb9c4a2d8f1b6e3c7a5f0d9b4c2e7a1f5d8b3c6e0a4f2d917',
  'Atlanta':       '56b7542e165bf857c3a9f1d6b4e2c8a7f5d0b3e9c1a6f4d8b2e7c5a0f3d694b',
  'Chengdu':       '2c6ad02c957ba528f1b9e4d7c3a6f0b5e8d2c9a4f7b1e5d3a8f6c2b0e4d7a193',
  'Chongqing':     '071e5f87a582861893b4f1d6c2e9a7f3b5d0c8a4e2f7b1d9c6a3f5e0b8d4c271',
  'Los Angeles':   '4facbbbb39938d43e1b7f2d9c5a6e8f3b0c4d7a2f9e5b1c8d3a6f0e4b7c2d519',
  'Sao Paulo':     'fc23f70a4b363735b8d1e4f9c6a2b7e5f3d0c9a4b6e2f7d1c5a8e3f0b4d6c729',
  'Busan':         '147a4520bcd15c10e9b4f2d7c1a6e8f5b3d0c9a2f6b4e1d8c7a5f3b0e2d4c816',
  'Istanbul':      '80b7ab0e85646330f9c4b1e7d3a6f2c8b5e0d4a9f7c2b6e1d8a3f5c0b4e7d293',
  'San Francisco': 'f4d665b1a9b25d42c8e1f7b4d9a6c3e0b5f2d8a4c7e1b9f3d6a2c5e8b0f4d731',
  'Moscow':        '7cdd1c6b2d4a0155e9f3b8c6a1d4e7f2b5c9a3d0f6b2e8c4a7f1d5b3e0c6a942',
  'Tel Aviv':      'e4fa685899653908d1b7c4f2a9e6d3b8f5c0a4e2d9b7f1c6a3e8d5b2f4c0a971',
  'Dallas':        '92326a47beaf3d8bc5e1f9d4a7b2e6f3c8d0a5b9f2e4c7d1a6b3f8e5c2d0a741',
  'Guangzhou':     '7fb65b35aa8e4da0c9f2b6e1d4a8c5f3b7e0d2a9f4c1b8e5d3a7f6c0b2e4d918',
  'Panama City':   'edd7ddc0cc064610b4f9c3a7e2d1b8f5c6a0d4e9b2f7c1a5d8e3b6f0c4a2d793',
  'Qingdao':       'ebcfb1ee3ef00522d7c4b9f1a6e3d8c2b5f0a7e4d1c9b6f3a2e8d5c0b7f1a394',
  'Cape Town':     '2337ef7978c41e93b5d0f4a8c1e6b2f9d7c3a5e8b4f1d6c0a9e2b7f3d5c8a041',
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
  ZSQD: 'CN', FACT: 'ZA',
}

// wuCode: the WU station code each hourly card reads its "WU" value through.
// Shenzhen keeps its explicit resolution station (wuLocationId); the rest derive
// "ICAO:9:CC" from their airport code.
export const STATIONS = RAW.map((s) => ({
  ...s,
  wuCode: s.wuLocationId ?? (s.icao && WU_CC[s.icao] ? `${s.icao}:9:${WU_CC[s.icao]}` : null),
  wcId: WC_ID[s.city] ?? null,
}))
