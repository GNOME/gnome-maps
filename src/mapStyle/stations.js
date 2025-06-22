/*
 * Copyright (C) 2025 Marcus Lundblad <ml@dfupdate.se>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <https://www.gnu.org/licenses/>.
 */

// generic defintion for German networks (U-Bahn and S-Bahn)
const DE_U_S_BAHN = {
  railway: {
    light_rail: "s-bahn",
    station: "s-bahn",
    subway: "u-bahn"
  }
};

// generic defintion for (some) Italian metro networks
const IT_METRO = {
  railway: {
    subway: "italy-m"
  }
};

// generic defintion for South Korean metro networks
const KR_METRO = {
  railway: {
    subway: "south-korea-m"
  }
};

/*
 * Define station icon mappings
 * Object with property names corresponding to network Wikidata tags,
 * with the fallback case using "_"
 * For each network the value is an object with property names corresponding
 * to the POI class (e.g. "railway"), using "_" as a fallback value
 * For each class the value is an object with property names corresponding
 * to the POI subclass (e.g. "subway", "tram_stop", "station", "light_rail"),
 * using "_" as fallback/catch-all case.
 * For each subclass the value is the icon name to use for that subclass
 */
const STATION_ICONS = {
  _: {
    railway: {
      funicular:  "funicular-symbolic",
      light_rail: "tram-symbolic",
      monorail:   "monorail-symbolic",
      station:    "train-symbolic",
      subway:     "subway-symbolic",
      tram_stop:  "tram-symbolic",
      _:          "train-symbolic"
    },
    _: {
      _: "train-symbolic"
    }
  },
  // BART (San Francisco Bay Area)
  Q610120: {
    railway: {
      subway: "bart"
    }
  },
  // Berlin (VBB)
  Q315451: DE_U_S_BAHN,
  // Boston (MTBA)
  Q171985: {
    railway: {
      _: "boston-t"
    }
  },
  // Metropolitana di Brescia
  Q3644334: IT_METRO,
  // Brussels (STIB)
  Q114957008: {
    railway: {
      subway: "brussels-m"
    }
  },
  // Busan Metro
  Q51972: {
    railway: {
      subway: "south-korea-m"
    }
  },
  // Metropolitana di Catania
  Q239927: {
    railway: {
      subway: "catania-m"
    }
  },
  // Copenhagen Metro
  Q212741: {
    railway: {
      subway: "copenhagen-m"
    }
  },
  // Daegu Subway
  Q49458: KR_METRO,
  // Daejeon Metro
  Q624200: KR_METRO,
  // Frankfurt (RMV)
  Q314042: DE_U_S_BAHN,
  // Metropolitana di Genova
  Q295335: IT_METRO,
  // Glasgow subway
  Q506290: {
    railway: {
      subway: "glasgow-s"
    }
  },
  // Gwangju Metro
  Q495335: KR_METRO,
  // Hamburg (HVV)
  Q896916: DE_U_S_BAHN,
  // Helsingin metro
  Q473211: {
    railway: {
      subway: "helsinki-m"
    }
  },
  // Hong Kong MTR
  Q14751: {
    railway: {
      _: "hongkong-mtr"
    }
  },
  // Great Britain National Rail
  Q26334: {
    railway: {
      _: "gb-national-rail"
    }
  },
  // Incheon Metro
  Q483883: KR_METRO,
  // Kiyv Metro
  Q215871: {
    railway: {
      subway: "kiyv-m"
    }
  },
  // London DLR
  Q216360: {
    railway: {
      light_rail: "london-dlr"
    }
  },
  // London Elizabeth Line
  Q111297173: {
    railway: {
      station: "london-elizabeth-line"
    }
  },
  // London Overground
  Q746021: {
    railway: {
      station: "london-overground"
    }
  },
  // London Tramlink
  Q786032: {
    railway: {
      tram_stop: "london-trams"
    }
  },
  // London Underground
  Q20075: {
    railway: {
      subway: "london-underground"
    }
  },
  // Madrid (Metro)
  Q191987: {
    railway: {
      subway: "madrid-metro"
    }
  },
  // Madrid (Commuter rail)
  Q1054785: {
    railway: {
      station: "madrid-c"
    }
  },
  // Metropolitana di Milano
  Q65125405: IT_METRO,
  // München
  Q259000: DE_U_S_BAHN,
  // Metropolitana di Napoli
  Q747184: IT_METRO,
  // Nürnberg
  Q2516463: DE_U_S_BAHN,
  // NYC Subway
  Q7733: {
    railway: {
      subway: "nyc-mta"
    }
  },
  // Oslo T-bane
  Q750292: {
    railway: {
      subway: "oslo-t"
    }
  },
  // Philadelphia (SEPTA)
  Q2037863: {
    railway: {
      _: "septa"
    }
  },
  // Prague Metro
  Q190271: {
    railway: {
      subway: "prague-m"
    }
  },
  // Metropolitana di Roma
  Q530087: IT_METRO,
  // Metro de Santiago
  Q913314: {
    railway: {
      subway: "santiago-metro"
    }
  },
  // Seoul Metro
  Q16950: KR_METRO,
  // Sofia Metro
  Q124360139: {
    railway: {
      subway: "sofia-m"
    }
  },
  // Stockholm T-bana
  Q970452: {
    railway: {
      subway: "stockholm-t"
    }
  },
  // Sydney Metro
  Q14774571: {
    railway: {
      _: "sydney-m"
    }
  },
  // Sydney Trains
  Q7660181: {
    railway: {
      _: "sydney-t"
    }
  },
  // Tbilisi Metro
  Q37006: {
    railway: {
      subway: "tbilisi-m"
    }
  },
  // Metropolitana di Torino
  Q135001237: IT_METRO,
  // Vienna (U-Bahn)
  Q209400: {
    railway: {
      subway: "wien-u"
    }
  },
  // Yerevan Metro
  Q320337: {
    railway: {
      subway: "yerevan-metro"
    }
  }
};

/**
 * Get a station icon suitable for a given (rail station) place.
 *
 * @param {import('../place.js').Place} place
 * @returns {string}
 */
export function getStationIconForPlace(place) {
  const railway = place?.osmTags?.['railway'] ?? place.osmKey;
  const station = place?.osmTags?.['station'];
  const clazz = railway ? 'railway' : undefined;
  let subClass;

  switch (railway) {
    case 'station':
      subClass = getSubclassForStation(station) ?? 'station';
      break;
    case 'halt':
      subClass = getSubclassForStation(station) ?? 'halt';
      break;
    case 'tram_stop':
      subClass = 'tram_stop';
      break;
    default:
      subClass = 'station';
      break;
  }

  return getIconForNetwork(place.networkWikidata, clazz, subClass) ??
         getIconForNetwork('_', clazz, subClass);
}

function getSubclassForStation(station) {
  switch (station) {
      case 'funicular':
        return 'funicular';
      case 'light_rail':
        return 'light_rail';
      case 'monorail':
        return 'monorail';
      case 'subway':
        return 'subway';
      default:
        return undefined;
    }
}

function getIconForNetwork(network, clazz, subClass) {
  return STATION_ICONS[network]?.[clazz]?.[subClass] ??
         STATION_ICONS[network]?.[clazz]?.["_"] ??
         STATION_ICONS[network]?.["_"];
}

export function getStationExpression() {
  const networks =
    Object.getOwnPropertyNames(STATION_ICONS).filter((x) => x[0] !== '_');
  return [
    "coalesce",
    [
      "match",
      ["get", "osm:network:wikidata"],
      ...networks.flatMap((network) =>
                          [network, getNetworkExpression(network)])
    ],
    getNetworkExpression('_')
  ];
}

function getNetworkExpression(network) {
  const fallback = STATION_ICONS[network]?.["_"]?.["_"] ?? null;
  const classes =
    Object.getOwnPropertyNames(STATION_ICONS[network]).filter((x) => x[0] !== '_');
  const subExpression = [
      "coalesce",
      [
        "match",
        ["get", "class"],
        ...classes.flatMap((clazz) =>
                           [clazz, getNetworkClassExpression(network, clazz)]),
        fallback,
      ].filter((x) => x !== null),
      network === '_' ? null : getNetworkExpression('_')
  ];

  return classes.length > 0 ?
         subExpression :
         STATION_ICONS[network]?.["_"]?.["_"] ?? getNetworkClassExpression('_', '_');
}

function getNetworkClassExpression(network, clazz) {
  const fallback = STATION_ICONS[network]?.[clazz]?.["_"] ?? null;
  const values =
    Object.entries(STATION_ICONS[network][clazz] ?? STATION_ICONS["_"][clazz])
    .filter((x) => x[0] !== "_")
    .flat();

  return values.length > 0 ? [
      "match",
      ["get", "subclass"],
      ...values,
      fallback,
  ].filter((x) => x !== null) : fallback;
}
