import http, { type Response } from 'k6/http'
import { type Options } from 'k6/options'
import { check, group, sleep } from 'k6'
import { selectProfile, type ProfileList, describeProfile } from '../common/utils/config/load-profiles'
