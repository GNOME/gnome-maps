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
  Q315451: {
    railway: {
      light_rail: "s-bahn",
      subway: "u-bahn"
    }
  },
  // Boston (MTBA)
  Q171985: {
    railway: {
      subway: "boston-t"
    }
  },
  // Brussels (STIB)
  Q114957008: {
    railway: {
      subway: "brussels-m"
    }
  },
  // Copenhagen Metro
  Q212741: {
    railway: {
      subway: "copenhagen-m"
    }
  },
  // Frankfurt (RMV)
  Q314042: {
    railway: {
      subway: "u-bahn"
    }
  },
  // Glasgow subway
  Q506290: {
    railway: {
      subway: "glasgow-s"
    }
  },
  // Hamburg (HVV)
  Q896916: {
    railway: {
      subway: "u-bahn",
      light_rail: "s-bahn"
    }
  },
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
  // National Rail (Great Britain)
  Q26334: {
    railway: {
      station: "gb-national-rail"
    }
  },
  // Nürnberg
  Q2516463: {
    railway: {
      station: "s-bahn",
      subway: "u-bahn"
    }
  },
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
  // Metro de Santiago
  Q913314: {
    railway: {
      subway: "santiago-metro"
    }
  },
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
  // Tbilisi Metro
  Q37006: {
    railway: {
      subway: "tbilisi-m"
    }
  },
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
  log(`getNetworkExpression: ${network}`);
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
      getNetworkClassExpression('_', '_')
  ];

  return classes.length > 0 ?
         subExpression :
         STATION_ICONS[network]?.["_"]?.["_"] ?? getNetworkClassExpression('_', '_');
}

function getNetworkClassExpression(network, clazz) {
  log(`getNetwotkClassExpression: ${network} ${clazz}`);
  const fallback = STATION_ICONS[network]?.[clazz]?.["_"] ?? null;
  const values =
    Object.entries(STATION_ICONS[network][clazz]).filter((x) => x[0] !== "_")
    .flat();

  return values.length > 0 ? [
      "match",
      ["get", "subclass"],
      ...values,
      fallback,
  ].filter((x) => x !== null) : fallback;
}
