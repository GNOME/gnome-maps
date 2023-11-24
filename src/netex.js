/* -*- Mode: JS2; indent-tabs-mode: nil; js2-basic-offset: 4 -*- */
/* vim: set et ts=4 sw=4: */
/*
 * Copyright (c) 2017 Marcus Lundblad
 *
 * GNOME Maps is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 2 of the License, or (at your
 * option) any later version.
 *
 * GNOME Maps is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with GNOME Maps; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Marcus Lundblad <ml@update.uu.se>
 */

import * as HVT from './hvt.js';

const MODE_MAP = {
    air:  {
        airshipService:                HVT.AIRSHIP_SERVICE,
        domesticFlight:                HVT.DOMESTIC_AIR_SERVICE,
        domesticScheduledFlight:       HVT.DOMESTIC_SCHEDULED_AIR_SERVICE,
        helicopterService:             HVT.HELICOPTER_AIR_SERVICE,
        intercontinentalFlight:        HVT.INTERCONTINENTAL_AIR_SERVICE,
        intercontinentalCharterFlight: HVT.INTERCONTINENTAL_CHARTER_AIR_SERVICE,
        internationalFlight:           HVT.INTERNATIONAL_AIR_SERVICE,
        internationalCharterFlight:    HVT.INTERNATIONAL_CHARTER_AIR_SERVICE,
        roundTripCharterFlight:        HVT.ROUND_TRIP_CHARTER_AIR_SERVICE,
        SchengenAreaFlight:            HVT.SCHENGEN_AREA_AIR_SERVICE,
        shortHaulInternationalFlight:  HVT.AIR_SERVICE, // TODO: missing HVT code?
        shuttleFlight:                 HVT.SHUTTLE_AIR_SERVICE,
        sightseeingFlight:             HVT.SIGHTSEEING_AIR_SERVICE,
        _:                             HVT.AIR_SERVICE
    },
    bus: {
        airportLinkBus:                  HVT.BUS_SERVICE, // TODO: missing HVT code?
        dedicatedLaneBus:                HVT.BUS_SERVICE, // TODO: missing HVT code?
        demandAndResponseBus:            HVT.DEMAND_AND_RESPONSE_BUS_SERVICE,
        expressBus:                      HVT.EXPRESS_BUS_SERVICE,
        highFrequencyBus:                HVT.BUS_SERVICE, // TODO: missing HVT code?
        localBus:                        HVT.LOCAL_BUS_SERVICE,
        nightBus:                        HVT.NIGHT_BUS_SERVICE,
        mobilityBus:                     HVT.MOBILITY_BUS_SERVICE,
        mobilityBusForRegisteredDisabled:HVT.MOBILITY_BUS_SERVICE_FOR_REGISTERED_DISABLED,
        postBus:                         HVT.POST_BUS_SERVICE,
        railReplacementBus:              HVT.RAIL_REPLACEMENT_BUS_SERVICE,
        regionalBus:                     HVT.REGIONAL_BUS_SERVICE,
        schoolBus:                       HVT.SCHOOL_BUS,
        schoolAndPublicServiceBus:       HVT.SCHOOL_AND_PUBLIC_SERVICE_BUS_SERVICE,
        shuttleBus:                      HVT.SHUTTLE_BUS,
        sightseeingBus:                  HVT.SIGHTSEEING_BUS,
        specialNeedsBus:                 HVT.SPECIAL_NEEDS_BUS_SERVICE,
        _:                               HVT.BUS_SERVICE
    },
    cableway: {
        _: HVT.CABLE_CAR
    },
    coach: {
        commuterCoach:      HVT.COMMUTER_COACH_SERVICE,
        internationalCoach: HVT.INTERNATIONAL_COACH_SERVICE,
        nationalCoach:      HVT.NATIONAL_COACH_SERVICE,
        regionalCoach:      HVT.REGIONAL_COACH_SERVICE,
        schoolCoach:        HVT.COACH_SERVICE, // TODO: missing HVT code?
        shuttleCoach:       HVT.SHUTTLE_COACH_SERVICE,
        sightseeingCoach:   HVT.SIGHTSEEING_COACH_SERVICE,
        specialCoach:       HVT.SPECIAL_COACH_SERVICE,
        touristCoach:       HVT.TOURIST_COACH_SERVICE,
        _:                  HVT.COACH_SERVICE
    },
    funicular: {
        _: HVT.FUNICULAR_SERVICE
    },
    metro: {
        _: HVT.METRO_SERVICE
    },
    monorail: {
        _: HVT.MONORAIL_SERVICE
    },
    taxi: {
        _: HVT.TAXI_SERVICE
    },
    tram: {
        cityTram:        HVT.CITY_TRAM_SERVICE,
        localTram:       HVT.LOCAL_TRAM_SERVICE,
        regionalTram:    HVT.REGIONAL_TRAM_SERVICE,
        sightseeingTram: HVT.SIGHTSEEING_TRAM_SERVICE,
        shuttleTram:     HVT.SHUTTLE_TRAM_SERVICE,
        trainTram:       HVT.TRAM_SERVICE,
        _:               HVT.TRAM_SERVICE
    },
    trolleybus: {
        _: HVT.TROLLEYBUS_SERVICE
    },
    rail: {
        highSpeedRail:           HVT.HIGH_SPEED_RAIL_SERVICE,
        suburbanRailway:         HVT.SUBURBAN_RAILWAY_SERVICE,
        regionalRail:            HVT.REGIONAL_RAIL_SERVICE,
        interregionalRail:       HVT.RAILWAY_SERVICE,
        sleeperRailService:      HVT.SLEEPER_RAIL_SERVICE,
        longDistance:            HVT.LONG_DISTANCE_TRAINS,
        nightRail:               HVT.RAILWAY_SERVICE,
        carTransportRailService: HVT.CAR_TRANSPORT_RAIL_SERVICE,
        touristRailway:          HVT.TOURIST_RAILWAY_SERVICE,
        airportLinkRail:         HVT.RAILWAY_SERVICE,
        railShuttle:             HVT.RAIL_SHUTTLE,
        replacementRailService:  HVT.REPLACEMENT_RAIL_SERVICE,
        specialTrain:            HVT.SPECIAL_RAIL_SERVICE,
        crossCountryRail:        HVT.CROSS_COUNTRY_RAIL_SERVICE,
        rackAndPinionRailway:    HVT.RACK_AND_PINION_RAILWAY,
        _:                       HVT.RAILWAY_SERVICE
    },
    water: {
        canalBarge: HVT.WATER_TRANSPORT_SERVICE,
        _:          HVT.WATER_TRANSPORT_SERVICE
    }
};

/**
 * Return HVT code given NeTex mode and submode.
 */
export function toHVT(mode, submode) {
    const modeMapping = MODE_MAP[mode];

    return modeMapping ? modeMapping[submode] ?? modeMapping['_'] : null;
}


