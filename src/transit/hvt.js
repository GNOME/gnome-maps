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

/*
 * Extended route types using HVT (Hierarchical Vehicle Type) codes from
 * the European TPEG standard.
 * https://support.google.com/transitpartners/answer/3520902
 */

/* when adding an additional constant here, make sure to edit the LAST_
 * constant for the corresponding block
 */

// rail services
export const RAILWAY_SERVICE = 100;
export const HIGH_SPEED_RAIL_SERVICE = 101;
export const LONG_DISTANCE_TRAINS = 102;
export const INTER_REGIONAL_RAIL_SERVICE = 103;
export const CAR_TRANSPORT_RAIL_SERVICE = 104;
export const SLEEPER_RAIL_SERVICE = 105;
export const REGIONAL_RAIL_SERVICE = 106;
export const TOURIST_RAILWAY_SERVICE = 107;
export const RAIL_SHUTTLE = 108;
export const SUBURBAN_RAILWAY = 109;
export const REPLACEMENT_RAIL_SERVICE = 110;
export const SPECIAL_RAIL_SERVICE = 111;
export const LORRY_TRANSPORT_RAIL_SERVICE = 112;
export const ALL_RAIL_SERVICES = 113;
export const CROSS_COUNTRY_RAIL_SERVICE = 114;
export const VEHICLE_TRANSPORT_RAIL_SERVICE = 115;
export const RACK_AND_PINION_RAILWAY = 116;
export const ADDITIONAL_RAIL_SERVICE = 117;
export const LAST_RAIL_SERVICE = ADDITIONAL_RAIL_SERVICE;

// coach services
export const COACH_SERVICE = 200;
export const INTERNATIONAL_COACH_SERVICE = 201;
export const NATIONAL_COACH_SERVICE = 202;
export const SHUTTLE_COACH_SERVICE = 203;
export const REGIONAL_COACH_SERVICE = 204;
export const SPECIAL_COACH_SERVICE = 205;
export const SIGHTSEEING_COACH_SERVICE = 206;
export const TOURIST_COACH_SERVICE = 207;
export const COMMUTER_COACH_SERVICE = 208;
export const ALL_COACH_SERVICES = 209;
export const LAST_COACH_SERVICE = ALL_COACH_SERVICES;

/// suburban railway services
export const SUBURBAN_RAILWAY_SERVICE = 300;

// urban railway services
export const URBAN_RAILWAY_SERVICE = 400;
export const URBAN_METRO_SERVICE = 401;
export const URBAN_UNDERGROUND_SERVICE = 402;
// this constant has the same name as 400 in the specification
export const URBAN_RAILWAY_SERVICE_2 = 403;
export const ALL_URBAN_RAILWAY_SERVICES = 404;
export const MONORAIL = 405;
export const LAST_URBAN_RAILWAY_SERVICE = MONORAIL;

// metro services
export const METRO_SERVICE = 500;

// underground services
export const UNDERGROUND_SERVICE = 600;

// bus services
export const BUS_SERVICE = 700;
export const REGIONAL_BUS_SERVICE = 701;
export const EXPRESS_BUS_SERVICE = 702;
export const STOPPING_BUS_SERVICE = 703;
export const LOCAL_BUS_SERVICE = 704;
export const NIGHT_BUS_SERVICE = 705;
export const POST_BUS_SERVICE = 706;
export const SPECIAL_NEEDS_BUS_SERVICE = 707;
export const MOBILITY_BUS_SERVICE = 708;
export const MOBILITY_BUS_SERVICE_FOR_REGISTERED_DISABLED = 709;
export const SIGHTSEEING_BUS = 710;
export const SHUTTLE_BUS = 711;
export const SCHOOL_BUS = 712;
export const SCHOOL_AND_PUBLIC_SERVICE_BUS_SERVICE = 713;
export const RAIL_REPLACEMENT_BUS_SERVICE = 714;
export const DEMAND_AND_RESPONSE_BUS_SERVICE = 715;
export const ALL_BUS_SERVICES = 716;
export const LAST_BUS_SERVICE = ALL_BUS_SERVICES;

// trolleybus services
export const TROLLEYBUS_SERVICE = 800;

// tram services
export const TRAM_SERVICE = 900;
export const CITY_TRAM_SERVICE = 901;
export const LOCAL_TRAM_SERVICE = 902;
export const REGIONAL_TRAM_SERVICE = 903;
export const SIGHTSEEING_TRAM_SERVICE = 904;
export const SHUTTLE_TRAM_SERVICE = 905;
export const ALL_TRAM_SERVICES = 906;
export const LAST_TRAM_SERVICE = ALL_TRAM_SERVICES;

// water transport services
export const WATER_TRANSPORT_SERVICE = 1000;
export const INTERNATIONAL_CAR_FERRY_SERVICE = 1001;
export const NATIONAL_CAR_FERRY_SERVICE = 1002;
export const REGIONAL_CAR_FERRY_SERVICE = 1003;
export const LOCAL_CAR_FERRY_SERVICE = 1004;
export const INTERNATIONAL_PASSENGER_FERRY_SERVICE = 1005;
export const NATIONAL_PASSENGER_FERRY_SERVICE = 1006;
export const REGIONAL_PASSENGER_FERRY_SERVICE = 1007;
export const LOCAL_PASSENGER_FERRY_SERVICE = 1008;
export const POST_BOAT_SERVICE = 1009;
export const TRAIN_FERRY_SERVICE = 1010;
export const ROAD_LINK_FERRY_SERVICE = 1011;
export const AIRPORT_LINK_FERRY_SERVICE = 1012;
export const CAR_HIGH_SPEED_FERRY_SERVICE = 1013;
export const PASSENGER_HIGH_SPEED_FERRY_SERVICE = 1014;
export const SIGHTSEEING_BOAT_SERVICE = 1015;
export const SCHOOL_BOAT = 1016;
export const CABLE_DRAWN_BOAT_SERVICE = 1017;
export const RIVER_BUS_SERVICE = 1018;
export const SCHEDULED_FERRY_SERVICE = 1019;
export const SHUTTLE_FERRY_SERVICE = 1020;
export const ALL_WATER_TRANSPORT_SERVICE = 1021;
export const LAST_WATER_TRANSPORT_SERVICE = ALL_WATER_TRANSPORT_SERVICE;

// air service
export const AIR_SERVICE = 1100;
export const INTERNATIONAL_AIR_SERVICE = 1101;
export const DOMESTIC_AIR_SERVICE = 1102;
export const INTERCONTINENTAL_AIR_SERVICE = 1103;
export const DOMESTIC_SCHEDULED_AIR_SERVICE = 1104;
export const SHUTTLE_AIR_SERVICE = 1105;
export const INTERCONTINENTAL_CHARTER_AIR_SERVICE = 1106;
export const INTERNATIONAL_CHARTER_AIR_SERVICE = 1107;
export const ROUND_TRIP_CHARTER_AIR_SERVICE = 1108;
export const SIGHTSEEING_AIR_SERVICE = 1109;
export const HELICOPTER_AIR_SERVICE = 1110;
export const DOMESTIC_CHARTER_AIR_SERVICE = 1111;
export const SCHENGEN_AREA_AIR_SERVICE = 1112;
export const AIRSHIP_SERVICE = 1113;
export const ALL_AIR_SERVICES = 1114;
export const LAST_AIR_SERVICE = ALL_AIR_SERVICES;

// ferry services
export const FERRY_SERVICE = 1200;

// telecabin services
export const TELECABIN_SERVICE = 1300;
export const TELECABIN_SERVICES = 1301;
// renamed this to not be confused with the tram-like street level cable cars
export const TELECABIN_CABLE_CAR_SERVICE = 1302;
export const ELEVATOR_SERVICE = 1303;
export const CHAIR_LIFT_SERVICE = 1304;
export const DRAG_LIFT_SERVICE = 1305;
export const SMALL_TELECABIN_SERVICE = 1306;
export const ALL_TELECABIN_SERVICES = 1307;
export const LAST_TELECABIN_SERVICE = ALL_TELECABIN_SERVICES;

// funicular services
export const FUNICULAR_SERVICE = 1400;
export const FUNICULAR_SERVICE_2 = 1401;
export const ALL_FUNICULAR_SERVICES = 1402;
export const LAST_FUNICULAR_SERVICE = ALL_FUNICULAR_SERVICES;

// taxi services
export const TAXI_SERVICE = 1500;
export const COMMUNAL_TAXI_SERVICE = 1501;
export const WATER_TAXI_SERVICE = 1502;
export const RAIL_TAXI_SERVICE = 1503;
export const BIKE_TAXI_SERVICE = 1504;
export const LICENSED_TAXI_SERVICE = 1505;
export const PRIVATE_HIRE_SERVICE_VEHICLE = 1506;
export const ALL_TAXI_SERVICES = 1507;
export const LAST_TAXI_SERVICE = ALL_TAXI_SERVICES;

// self drive
export const SELF_DRIVE = 1600;
export const HIRE_CAR = 1601;
export const HIRE_VAN = 1602;
export const HIRE_MOTORBIKE = 1603;
export const HIRE_CYCLE = 1604;
export const LAST_SELF_DRIVE = HIRE_CYCLE;

// misc. service
export const MISCELLANEOUS_SERVICE = 1700;
export const CABLE_CAR = 1701;
export const HORSE_DRAWN_CARRIAGE = 1702;
export const LAST_MISCELLANEOUS_SERVCE = HORSE_DRAWN_CARRIAGE;

/**
 * returns the super type of a given HVT type code, or -1 if the supplied code
 * is not among the defined codes
 */
export function supertypeOf(type) {
    if (type >= RAILWAY_SERVICE && type <= LAST_RAIL_SERVICE)
        return RAILWAY_SERVICE;
    else if (type >= COACH_SERVICE && type <= LAST_COACH_SERVICE)
        return COACH_SERVICE;
    else if (type == SUBURBAN_RAILWAY_SERVICE)
        return SUBURBAN_RAILWAY_SERVICE;
    else if (type >= URBAN_RAILWAY_SERVICE && type <= LAST_URBAN_RAILWAY_SERVICE)
        return URBAN_RAILWAY_SERVICE;
    else if (type == METRO_SERVICE)
        return METRO_SERVICE;
    else if (type == UNDERGROUND_SERVICE)
        return UNDERGROUND_SERVICE;
    else if (type >= BUS_SERVICE && type <= LAST_BUS_SERVICE)
        return BUS_SERVICE;
    else if (type == TROLLEYBUS_SERVICE)
        return TROLLEYBUS_SERVICE;
    else if (type >= TRAM_SERVICE && type <= LAST_TRAM_SERVICE)
        return TRAM_SERVICE;
    else if (type >= WATER_TRANSPORT_SERVICE &&
             type <= LAST_WATER_TRANSPORT_SERVICE)
        return WATER_TRANSPORT_SERVICE;
    else if (type >= AIR_SERVICE && type <= LAST_AIR_SERVICE)
        return AIR_SERVICE;
    else if (type == FERRY_SERVICE)
        return FERRY_SERVICE;
    else if (type >= TELECABIN_SERVICE && type <= LAST_TELECABIN_SERVICE)
        return TELECABIN_SERVICE;
    else if (type >= FUNICULAR_SERVICE && type <= LAST_FUNICULAR_SERVICE)
        return FUNICULAR_SERVICE;
    else if (type >= TAXI_SERVICE && type <= LAST_TAXI_SERVICE)
        return TAXI_SERVICE;
    else if (type >= SELF_DRIVE && type <= LAST_SELF_DRIVE)
        return SELF_DRIVE;
    else if (type >= MISCELLANEOUS_SERVICE && type <= LAST_MISCELLANEOUS_SERVCE)
        return MISCELLANEOUS_SERVICE;
    else
        return -1;
}
