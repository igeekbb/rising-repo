import { getDate, sleep } from '@/lib/util'
import getRankList, { IRankItem } from '@/lib/getRank/getRankList'
import getARepo from '@/lib/getRank/getARepo'
import { getDB } from '@/lib/lowdb'

export type IRankItemWithRepoInfo = IRankItem & {
  language: string
  ownerAvatar: string
  ownerLogin: string
  description: string
  createdAt: string
  topics: string[]
}

export default async function getRank() {
  const db = await getDB()

  // Always return local data first
  if (db.data.repoInfoList.length) {
    return db.data.repoInfoList
  }

  // Try online if local is empty
  const { start, end } = getDate()
  const rankList = await getRankList({ start, end, limit: 1000, offset: 0 })

  if (!rankList.length) return []

  const repoInfoList: IRankItemWithRepoInfo[] = []
  const batchSize = 80

  for (let i = 0; i < rankList.length; i += batchSize) {
    const promiseList = rankList.slice(i, i + batchSize).map(async (item) => {
      const repo = await getARepo({ repoName: item.repoName })
      if (!repo) return null
      return {
        repoName: item.repoName, addedStars: item.addedStars,
        language: repo.language, ownerAvatar: repo.owner.avatar_url,
        ownerLogin: repo.owner.login, description: repo.description,
        createdAt: repo.created_at, topics: repo.topics,
      }
    })
    const batch = (await Promise.all(promiseList)).filter(Boolean) as IRankItemWithRepoInfo[]
    await sleep(100)
    repoInfoList.push(...batch)
  }

  if (repoInfoList.length) {
    db.data.repoInfoList = repoInfoList
    await db.write()
  }

  return repoInfoList
}
