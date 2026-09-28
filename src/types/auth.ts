import type { components } from './generated/http';

type Schema = components['schemas'];
export type User = Schema['User'];
export type LoginRequest = Schema['LoginRequest'];
export type LoginResponse = Schema['AuthResponse'];
export type RegisterRequest = Schema['RegisterRequest'];
export type RegisterResponse = Schema['AuthResponse'];
export type RefreshTokenRequest = Schema['RefreshTokenRequest'];
export type RefreshTokenResponse = Schema['TokenResponse'];
export type UpdateProfileRequest = Schema['UpdateProfileRequest'];
export type UpdateProfileResponse = Schema['User'];
export type ChangePasswordRequest = Schema['ChangePasswordRequest'];
export type ChangePasswordResponse = Schema['SuccessResult'];
export type DeleteAccountResponse = Schema['DeleteAccountResponse'];
export interface AuthTokens { accessToken: string | null; refreshToken: string | null; }
