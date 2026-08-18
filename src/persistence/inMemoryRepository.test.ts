import { createInMemoryRepository } from './inMemoryRepository'
import { runRepositoryContractTests } from './repositoryContract'

runRepositoryContractTests(() => createInMemoryRepository())
