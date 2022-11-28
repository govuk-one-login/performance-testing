import { Scenario } from "k6/options";

export type ScenarioList = { [name: string]: Scenario };
export type ProfileList = { [name: string]: ScenarioList };
export type Profile = {
    name: string,
    scenarios: ScenarioList,
}
export type ProfileConfig = {
    profile: string,
    scenario?: string,
}

// Returns a single load profile from a list of load profiles
// Intended to work with CLI flags e.g. '--env PROFILE=smoke'
export function getProfile(profiles: ProfileList, profileName: string): Profile {
    if (profileName == null) throw new Error('No profile specified');
    if (profileName in profiles) {
        return {
            name: profileName,
            scenarios: profiles[profileName]
        };
    }
    throw new Error(`Selection '${profileName}' does not exist. Valid options are '${Object.keys(profiles)}'`);
}

// Returns a subset of scenarios based on a comma seperated list of selections
// Intended to work with CLI flags e.g. '--env SCENARIO=sign_in,sign_up'
// If selections parameter is not specified then all scenarios are enabled
export function getScenarios(scenarios: ScenarioList, selections: string | undefined): ScenarioList {
    let enabled: ScenarioList = {};
    selections == null || selections == '' || selections.toLowerCase() == 'all' ?   // Enable all scenarios is selection string is null, empty or set to 'all'
        enabled = scenarios :
        selections.split(',').forEach(scenario => enabled[scenario] = scenarios[scenario]);
    return enabled;
}

// Default config uses the CLI flags
// '--env PROFILE' specifies the load profile to use, defaults to 'smoke'
// '--env SCENARIO' specifies which scenarios within the load profile to use, defaults to all
let defaultConfig: ProfileConfig = {
    profile: __ENV.PROFILE ?? 'smoke',
    scenario: __ENV.SCENARIO ?? 'all',
};
export function selectProfile(profiles: ProfileList, config: typeof defaultConfig = defaultConfig): Profile {
    let profile = getProfile(profiles, config.profile);
    return {
        name: profile.name,
        scenarios: getScenarios(profile.scenarios, config.scenario)
    };
}

export function describeProfile(profile: Profile): void {
    console.log(`Load Profile: <\x1b[32m${profile.name}\x1b[0m>`);
    console.log(`Scenarios: <\x1b[34m${Object.keys(profile.scenarios).join('\x1b[0m|\x1b[34m')}\x1b[0m>`);
}