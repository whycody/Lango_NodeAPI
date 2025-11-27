export interface LoginRequest {
  deviceId: string;
  timezone: string;
}

export interface FacebookLoginRequest extends LoginRequest {
  accessToken: string;
}

export interface GoogleLoginRequest extends LoginRequest {
  idToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceId: string;
}

export interface LogoutRequest {
  deviceId: string;
}