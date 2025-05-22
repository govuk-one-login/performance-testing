type Journey = 'AUTHENTICATION' | 'REAUTHENTICATION' | 'WALLET_CREDENTIAL_ISSUANCE'

export function getJourney(): Journey {
  const random = Math.random()
  const journey = CUMULATIVE_DISTRIBUTION.find(
    cumulativeDistributionMapping => random < cumulativeDistributionMapping.cumulativeProbability
  )?.journey
  return journey ?? 'AUTHENTICATION'
}

const JOURNEY_TPS_MAPPING: Record<Journey, number> = {
  WALLET_CREDENTIAL_ISSUANCE: 38,
  AUTHENTICATION: 16,
  REAUTHENTICATION: 8
}

const CUMULATIVE_DISTRIBUTION = getCumulativeDistribution()

function getCumulativeDistribution() {
  const TOTAL_TPS = Object.values(JOURNEY_TPS_MAPPING).reduce((a, b) => a + b, 0)
  let cumulativeProbability = 0
  const cumulativeDistribution: { journey: Journey; cumulativeProbability: number }[] = []
  Object.entries(JOURNEY_TPS_MAPPING).forEach(([journey, tps]) => {
    const weight = tps / TOTAL_TPS
    cumulativeProbability += weight
    cumulativeDistribution.push({
      journey: journey as Journey,
      cumulativeProbability
    })
  })
  cumulativeDistribution[cumulativeDistribution.length - 1].cumulativeProbability = 1 // Cumulative probability density must sum to 1 - this ensures that this is the case by avoiding any errors by rounding
  return cumulativeDistribution
}
