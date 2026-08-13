import { AnimeDetails } from '../types/anifox';

const ANILIST_API = 'https://graphql.anilist.co';

export const anilistQuery = async (query: string, variables: Record<string, any> = {}): Promise<any> => {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables })
  };

  try {
    const res = await fetch(ANILIST_API, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.errors?.[0]?.message || 'AniList API Error');
    return data.data;
  } catch (error) {
    console.error('AniList API Error:', error);
    throw error;
  }
};

export const getTrendingAnime = async (): Promise<AnimeDetails[]> => {
  const query = `
    query {
      Page(page: 1, perPage: 20) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
            extraLarge
          }
          bannerImage
          description(asHtml: false)
          averageScore
          episodes
          status
        }
      }
    }
  `;
  const data = await anilistQuery(query);
  return data.Page.media;
};

export const searchAnime = async (search: string): Promise<AnimeDetails[]> => {
  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 20) {
        media(search: $search, sort: POPULARITY_DESC, type: ANIME, isAdult: false) {
          id
          title {
            romaji
            english
          }
          coverImage {
            large
          }
          averageScore
          episodes
          status
        }
      }
    }
  `;
  const data = await anilistQuery(query, { search });
  return data.Page.media;
};

export const getAnimeDetails = async (id: number | string): Promise<AnimeDetails> => {
  const query = `
    query ($id: Int) {
      Media(id: $id) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        genres
        averageScore
        episodes
        status
        format
        duration
        countryOfOrigin
        season
        seasonYear
        startDate { year month day }
        endDate { year month day }
        studios(isMain: true) { nodes { name } }
        producers: studios(isMain: false) { nodes { name } }
        nextAiringEpisode {
          episode
        }
        idMal
        trailer {
          id
          site
          thumbnail
        }
        isAdult
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              type
              format
              coverImage {
                large
              }
              relations {
                edges {
                  relationType
                  node {
                    id
                    title {
                      romaji
                      english
                    }
                    type
                    format
                    coverImage {
                      large
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await anilistQuery(query, { id: Number(id) });
  return data.Media;
};
