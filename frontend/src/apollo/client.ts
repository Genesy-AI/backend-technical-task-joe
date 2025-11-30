import { ApolloClient, InMemoryCache, gql, HttpLink } from '@apollo/client'

export const apolloClient = new ApolloClient({
    link: new HttpLink({ uri: 'http://localhost:4000/graphql' }),
    cache: new InMemoryCache()
})

// GraphQL Mutations
export const ENRICH_LEADS = gql`
  mutation EnrichLeads($leadIds: [Int!]!, $operations: [EnrichmentOperation!]!) {
    enrichLeads(leadIds: $leadIds, operations: $operations) {
      jobId
      totalLeads
      operations
    }
  }
`
