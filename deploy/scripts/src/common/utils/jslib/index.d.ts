import { type Stage } from 'k6/options'

/**
* Function that returns a string from between two other strings.
* https://k6.io/docs/javascript-api/jslib/utils/findbetween/
*
* @param {string} content The string to search through (e.g. `Response.body`)
* @param {string} left The string immediately before the value to be extracted
* @param {string} right The string immediately after the value to be extracted
* @param {boolean} [repeat] If `true`, the result will be a string array containing all occurrences
* @returns The extracted string, or an empty string if no match was found.
*          If `repeat=true`, this will be an array of strings or an empty array
* @example
* const response = '<div class="message">Message 1</div><div class="message">Message 2</div>'
*
* const message = findBetween(response, '<div class="message">', '</div>')
* console.log(message) // Message 1
*
* const allMessages = findBetween(response, '<div class="message">', '</div>', true)
* console.log(allMessages.length) // 2
*/
export function findBetween (content: string, left: string, right: string, repeat?: boolean): string | string[]

/**
* Function to create `stages` producing a normal distribution (bell-curve) of VUs for a test.
* https://k6.io/docs/javascript-api/jslib/utils/normaldistributionstages/
*
* @param {number} maxVus Maximum virtual users at the height of the curve
* @param {number} durationSeconds Overall duration for all stages combined
* @param {number} [numberOfStages] Number of stages to create; default is `10`
* @returns An array of `{"duration": "XXXs", "target": XXX}` JSON objects representing stages
* @example
* export const options = {
*   // Alters the number of VUs from 1 to 10 over a period
*   // of 20 seconds comprised of 5 stages.
*   stages: normalDistributionStages(10, 20, 5)
* }
*/
export function normalDistributionStages (maxVus: number, durationSeconds: number, numberOfStages?: number): Stage[]

/**
* Function returns a random number between the specified range.
* The returned value is no lower than (and may possibly equal) min,
* and is no bigger than (and may possibly equal) max.
* https://k6.io/docs/javascript-api/jslib/utils/randomintbetween/
*
* @param {number} min Lower-end bound. Inclusive
* @param {number} max Upper-end bound. Inclusive
* @returns Random item from the array
* @example
* sleep(randomIntBetween(1, 5)); // sleep between 1 and 5 seconds.
*/
export function randomIntBetween (min: number, max: number): number

/**
* Function returns a random item from an array.
* https://k6.io/docs/javascript-api/jslib/utils/randomitem/
*
* @param {T[]} arrayOfItems Array [] of items
* @returns {T} Random item from the array
* @example
* const names = ['John', 'Jane', 'Bert', 'Ed']
* const randomName = randomItem(names)
* console.log(`Hello, my name is ${randomName}`)
*/
export function randomItem<T> (arrayOfItems: T[]): T

/**
* Function returns a random string of a given length, optionally selected from a custom character set.
* https://k6.io/docs/javascript-api/jslib/utils/randomstring/
*
* @param {number} length Length of the random string
* @param {string} [charset] A customized list of characters
* @returns {string} Random item(s) from the array of characters
* @example
* const randomFirstName = randomString(8)
* console.log(`Hello, my first name is ${randomFirstName}`)
*
* const randomLastName = randomString(10, `aeioubcdfghijpqrstuv`)
* console.log(`Hello, my last name is ${randomLastName}`)
*
* const randomCharacterWeighted = randomString(1, `AAAABBBCCD`)
* console.log(`Chose a random character ${randomCharacterWeighted}`)
*/
export function randomString (length: number, charset?: string): string

/**
* Function returns a random uuid v4 in a string form.
* https://k6.io/docs/javascript-api/jslib/utils/uuidv4/
*
* @param {boolean} [secure] By default, uuidv4() uses a standard random number generator.
*        If the secure option is set to true, uuidv4 uses a cryptographically secure random number generator instead.
*        While this adds security, the secure option also makes the function an order of magnitude slower.
* @returns {string} Random UUID v4 string
* @example
* const randomUUID = uuidv4()
* console.log(randomUUID) // 35acae14-f7cb-468a-9866-1fc45713149a
*/
export function uuidv4 (secure?: boolean): string
