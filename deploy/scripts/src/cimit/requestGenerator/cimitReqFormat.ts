export interface PutContraIndicators {
  govuk_signin_journey_id: string;
  signed_jwt: string;
  ip_address: string;
}

export interface GetContraIndicatorCredential {
  govuk_signin_journey_id: string;
  user_id: string;
  ip_address: string;
}

export interface PostMitigations {
  govuk_signin_journey_id: string;
  signed_jwts: string[];
  ip_address: string;
}
