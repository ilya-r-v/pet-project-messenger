export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
}