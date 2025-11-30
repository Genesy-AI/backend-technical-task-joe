export const typeDefs = `
  enum EnrichmentOperation {
    VERIFY_EMAIL
    PHONE_LOOKUP
  }

  type EnrichmentJob {
    jobId: ID!
    totalLeads: Int!
    operations: [EnrichmentOperation!]!
  }

  type Query {
    # Placeholder - can add job status query later
    _empty: String
  }

  type Mutation {
    enrichLeads(
      leadIds: [Int!]!
      operations: [EnrichmentOperation!]!
    ): EnrichmentJob!
  }
`
