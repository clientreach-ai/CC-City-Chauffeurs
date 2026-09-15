/**
 * The shared domain contract.
 *
 * One definition of what a vehicle, a service or an enquiry *is*, imported by
 * the API that stores them, the admin that edits them and the website that
 * prints them. When a shape changes here, everything that disagrees stops
 * compiling — which is the point.
 */
export * from "./types";
export * from "./validation";
export * from "./status";
export * from "./permissions";
export * from "./format";
export * from "./image";
export * from "./rules";
