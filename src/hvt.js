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
const RAILWAY_SERVICE = 100;
const HIGH_SPEED_RAIL_SERVICE = 101;
const LONG_DISTANCE_TRAINS = 102;
const INTER_REGIONAL_RAIL_SERVICE = 103;
const CAR_TRANSPORT_RAIL_SERVICE = 104;
const SLEEPER_RAIL_SERVICE = 105;
const REGIONAL_RAIL_SERVICE = 106;
const TOURIST_RAILWAY_SERVICE = 107;
const RAIL_SHUTTLE = 108;
const SUBURBAN_RAILWAY = 109;
const REPLACEMENT_RAIL_SERVICE = 110;
const SPECIAL_RAIL_SERVICE = 111;
const LORRY_TRANSPORT_RAIL_SERVICE = 112;
const ALL_RAIL_SERVICES = 113;
const CROSS_COUNTRY_RAIL_SERVICE = 114;
const VEHICLE_TRANSPORT_RAIL_SERVICE = 115;
const RACK_AND_PINION_RAILWAY = 116;
const ADDITIONAL_RAIL_SERVICE = 117;
const LAST_RAIL_SERVICE = ADDITIONAL_RAIL_SERVICE;

// coach services
const COACH_SERVICE = 200;
const INTERNATIONAL_COACH_SERVICE = 201;
const NATIONAL_COACH_SERVICE = 202;
const SHUTTLE_COACH_SERVICE = 203;
const REGIONAL_COACH_SERVICE = 204;
const SPECIAL_COACH_SERVICE = 205;
const SIGHTSEEING_COACH_SERVICE = 206;
const TOURIST_COACH_SERVICE = 207;
const COMMUTER_COACH_SERVICE = 208;
const ALL_COACH_SERVICES = 209;
const LAST_COACH_SERVICE = ALL_COACH_SERVICES;

/// suburban railway services
const SUBURBAN_RAILWAY_SERVICE = 300;

// urban railway services
const URBAN_RAILWAY_SERVICE = 400;
const URBAN_METRO_SERVICE = 401;
const URBAN_UNDERGROUND_SERVICE = 402;
// this constant has the same name as 400 in the specification
const URBAN_RAILWAY_SERVICE_2 = 403;
const ALL_URBAN_RAILWAY_SERVICES = 404;
const MONORAIL = 405;
const LAST_URBAN_RAILWAY_SERVICE = MONORAIL;

// metro services
const METRO_SERVICE = 500;

// underground services
const UNDERGROUND_SERVICE = 600;

// bus services
const BUS_SERVICE = 700;
const REGIONAL_BUS_SERVICE = 701;
const EXPRESS_BUS_SERVICE = 702;
const STOPPING_BUS_SERVICE = 703;
const LOCAL_BUS_SERVICE = 704;
const NIGHT_BUS_SERVICE = 705;
const POST_BUS_SERVICE = 706;
const SPECIAL_NEEDS_BUS_SERVICE = 707;
const MOBILITY_BUS_SERVICE = 708;
const MOBILITY_BUS_SERVICE_FOR_REGISTERED_DISABLED = 709;
const SIGHTSEEING_BUS = 710;
const SHUTTLE_BUS = 711;
const SCHOOL_BUS = 712;
const SCHOOL_AND_PUBLIC_SERVICE_BUS_SERVICE = 713;
const RAIL_REPLACEMENT_BUS_SERVICE = 714;
const DEMAND_AND_RESPONSE_BUS_SERVICE = 715;
const ALL_BUS_SERVICES = 716;
const LAST_BUS_SERVICE = ALL_BUS_SERVICES;

// trolleybus services
const TROLLEYBUS_SERVICE = 800;

// tram services
const TRAM_SERVICE = 900;
const CITY_TRAM_SERVICE = 901;
const LOCAL_TRAM_SERVICE = 902;
const REGIONAL_TRAM_SERVICE = 903;
const SIGHTSEEING_TRAM_SERVICE = 904;
const SHUTTLE_TRAM_SERVICE = 905;
const ALL_TRAM_SERVICES = 906;
const LAST_TRAM_SERVICE = ALL_TRAM_SERVICES;

// water transport services
const WATER_TRANSPORT_SERVICE = 1000;
const INTERNATIONAL_CAR_FERRY_SERVICE = 1001;
const NATIONAL_CAR_FERRY_SERVICE = 1002;
const REGIONAL_CAR_FERRY_SERVICE = 1003;
const LOCAL_CAR_FERRY_SERVICE = 1004;
const INTERNATIONAL_PASSENGER_FERRY_SERVICE = 1005;
const NATIONAL_PASSENGER_FERRY_SERVICE = 1006;
const REGIONAL_PASSENGER_FERRY_SERVICE = 1007;
const LOCAL_PASSENGER_FERRY_SERVICE = 1008;
const POST_BOAT_SERVICE = 1009;
const TRAIN_FERRY_SERVICE = 1010;
const ROAD_LINK_FERRY_SERVICE = 1011;
const AIRPORT_LINK_FERRY_SERVICE = 1012;
const CAR_HIGH_SPEED_FERRY_SERVICE = 1013;
const PASSENGER_HIGH_SPEED_FERRY_SERVICE = 1014;
const SIGHTSEEING_BOAT_SERVICE = 1015;
const SCHOOL_BOAT = 1016;
const CABLE_DRAWN_BOAT_SERVICE = 1017;
const RIVER_BUS_SERVICE = 1018;
const SCHEDULED_FERRY_SERVICE = 1019;
const SHUTTLE_FERRY_SERVICE = 1020;
const ALL_WATER_TRANSPORT_SERVICE = 1021;
const LAST_WATER_TRANSPORT_SERVICE = ALL_WATER_TRANSPORT_SERVICE;

// air service
const AIR_SERVICE = 1100;
const INTERNATIONAL_AIR_SERVICE = 1101;
const DOMESTIC_AIR_SERVICE = 1102;
const INTERCONTINENTAL_AIR_SERVICE = 1103;
const DOMESTIC_SCHEDULED_AIR_SERVICE = 1104;
const SHUTTLE_AIR_SERVICE = 1105;
const INTERCONTINENTAL_CHARTER_AIR_SERVICE = 1106;
const INTERNATIONAL_CHARTER_AIR_SERVICE = 1107;
const ROUND_TRIP_CHARTER_AIR_SERVICE = 1108;
const SIGHTSEEING_AIR_SERVICE = 1109;
const HELICOPTER_AIR_SERVICE = 1110;
const DOMESTIC_CHARTER_AIR_SERVICE = 1111;
const SCHENGEN_AREA_AIR_SERVICE = 1112;
const AIRSHIP_SERVICE = 1113;
const ALL_AIR_SERVICES = 1114;
const LAST_AIR_SERVICE = ALL_AIR_SERVICES;

// ferry services
const FERRY_SERVICE = 1200;

// telecabin services
const TELECABIN_SERVICE = 1300;
const TELECABIN_SERVICES = 1301;
// renamed this to not be confused with the tram-like street level cable cars
const TELECABIN_CABLE_CAR_SERVICE = 1302;
const ELEVATOR_SERVICE = 1303;
const CHAIR_LIFT_SERVICE = 1304;
const DRAG_LIFT_SERVICE = 1305;
const SMALL_TELECABIN_SERVICE = 1306;
const ALL_TELECABIN_SERVICES = 1307;
const LAST_TELECABIN_SERVICE = ALL_TELECABIN_SERVICES;

// funicular services
const FUNICULAR_SERVICE = 1400;
const FUNICULAR_SERVICE_2 = 1401;
const ALL_FUNICULAR_SERVICES = 1402;
const LAST_FUNICULAR_SERVICE = ALL_FUNICULAR_SERVICES;

// taxi services
const TAXI_SERVICE = 1500;
const COMMUNAL_TAXI_SERVICE = 1501;
const WATER_TAXI_SERVICE = 1502;
const RAIL_TAXI_SERVICE = 1503;
const BIKE_TAXI_SERVICE = 1504;
const LICENSED_TAXI_SERVICE = 1505;
const PRIVATE_HIRE_SERVICE_VEHICLE = 1506;
const ALL_TAXI_SERVICES = 1507;
const LAST_TAXI_SERVICE = ALL_TAXI_SERVICES;

// self drive
const SELF_DRIVE = 1600;
const HIRE_CAR = 1601;
const HIRE_VAN = 1602;
const HIRE_MOTORBIKE = 1603;
const HIRE_CYCLE = 1604;
const LAST_SELF_DRIVE = HIRE_CYCLE;

// misc. service
const MISCELLANEOUS_SERVICE = 1700;
const CABLE_CAR = 1701;
const HORSE_DRAWN_CARRIAGE = 1702;
const LAST_MISCELLANEOUS_SERVCE = HORSE_DRAWN_CARRIAGE;

/**
 * returns the super type of a given HVT type code, or -1 if the supplied code
 * is not among the defined codes
 */
function supertypeOf(type) {
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
