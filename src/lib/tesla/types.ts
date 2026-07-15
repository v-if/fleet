export type TeslaVehicleListItem = {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string | null;
  state: "online" | "offline" | "asleep" | string;
  /** string form of id — Fleet API path용 */
  id_s?: string;
  access_type?: string | null;
};

export type TeslaVehicleListResponse = {
  response: TeslaVehicleListItem[];
  pagination?: {
    next?: string | null;
  };
};

export type TeslaFleetStatusItem = {
  vin: string;
  firmware_version?: string;
  vehicle_command_protocol_required?: boolean;
  discounted_device_data?: boolean;
  fleet_telemetry_version?: string;
};

export type TeslaFleetStatusResponse = {
  response: {
    key_paired_vins?: string[];
    unpaired_vins?: string[];
    vehicle_info?:
      | TeslaFleetStatusItem[]
      | Record<string, TeslaFleetStatusItem>
      | {
          vehicle_info?: TeslaFleetStatusItem[];
        };
  };
};

export type TeslaAlert = {
  name?: string;
  time?: string;
  audience?: string[];
  user_text?: string;
};

export type TeslaRecentAlertsResponse = {
  response: {
    recent_alerts?: TeslaAlert[];
  };
};

export type TeslaNearbyChargingSite = {
  name?: string;
  distance_miles?: number;
  available_stalls?: number;
  total_stalls?: number;
};

export type TeslaNearbyChargingSitesResponse = {
  response: {
    destination_charging?: TeslaNearbyChargingSite[];
    superchargers?: TeslaNearbyChargingSite[];
  };
};

export type TeslaServiceDataResponse = {
  response: {
    service_status?: string | null;
    service_etc?: string | null;
    service_months?: number | null;
    service_miles?: number | null;
  };
};

export type TeslaVehicleDataResponse = {
  response: {
    id?: number;
    vin?: string;
    display_name?: string | null;
    state?: string;
    charge_state?: {
      battery_level?: number;
      est_battery_range?: number;
      battery_range?: number;
      charging_state?: string;
      charge_limit_soc?: number;
      charger_power?: number;
    };
    drive_state?: {
      latitude?: number;
      longitude?: number;
      speed?: number | null;
      shift_state?: string | null;
      power?: number;
    };
    vehicle_state?: {
      odometer?: number;
      locked?: boolean;
      sentry_mode?: boolean;
      car_version?: string;
      vehicle_name?: string | null;
      tpms_pressure_fl?: number;
      tpms_pressure_fr?: number;
      tpms_pressure_rl?: number;
      tpms_pressure_rr?: number;
      df?: number;
      dr?: number;
      pf?: number;
      pr?: number;
      ft?: number;
      rt?: number;
    };
    climate_state?: {
      inside_temp?: number;
      outside_temp?: number;
      is_climate_on?: boolean;
    };
    closures_state?: {
      door_open?: boolean;
      trunk_open?: boolean;
      rear_trunk_open?: boolean;
      window_open?: boolean;
    };
    vehicle_config?: {
      car_type?: string;
      trim_badging?: string;
      exterior_color?: string;
      exterior_trim?: string;
      roof_color?: string;
      wheel_type?: string;
      charge_port_type?: string;
      driver_assist?: string;
      [key: string]: unknown;
    };
  };
};

export type TeslaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
};
