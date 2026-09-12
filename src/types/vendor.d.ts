// Type shims for modules that don't ship their own declarations.
// These are referenced from tsconfig.json → "include" automatically.

declare module "twilio" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Twilio: any;
  export default Twilio;
}

declare module "mapbox-gl/dist/mapbox-gl.css" {
  const css: string;
  export default css;
}

declare module "firebase/auth" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const getAuth: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const RecaptchaVerifier: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const signInWithPhoneNumber: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PhoneAuthProvider: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const signInWithCredential: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Auth = any;
}
