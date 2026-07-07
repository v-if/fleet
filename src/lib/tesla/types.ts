export type TeslaVehicleListItem = {
  id: number;
  vehicle_id: number;
  vin: string;
  display_name: string | null;
  state: "online" | "offline" | "asleep" | string;
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
    vehicle_info?: TeslaFleetStatusItem[];
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
    };
  };
};

export type TeslaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};
