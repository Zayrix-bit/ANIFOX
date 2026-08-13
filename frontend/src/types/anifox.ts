export interface Subtitle {
  url: string;
  lang: string;
}

export interface AnimeTitle {
  romaji?: string;
  english?: string;
  native?: string;
}

export interface AnimeCoverImage {
  extraLarge?: string;
  large?: string;
}

export interface StudioNode {
  name: string;
}

export interface Studios {
  nodes: StudioNode[];
}

export interface Trailer {
  id: string;
  site: string;
  thumbnail: string;
}

export interface RelatedAnime {
  id: number;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  averageScore?: number;
  format?: string;
  episodes?: number;
}

export interface RelationEdge {
  relationType: string;
  node: RelatedAnime;
}

export interface Relations {
  edges: RelationEdge[];
}

export interface RecommendationNode {
  mediaRecommendation: RelatedAnime;
}

export interface Recommendations {
  nodes: RecommendationNode[];
}

export interface AnimeDetails {
  id: number;
  title: AnimeTitle;
  coverImage: AnimeCoverImage;
  bannerImage?: string;
  description?: string;
  genres?: string[];
  averageScore?: number;
  episodes?: number;
  status?: string;
  format?: string;
  duration?: number;
  countryOfOrigin?: string;
  season?: string;
  seasonYear?: number;
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
  studios?: Studios;
  producers?: Studios;
  nextAiringEpisode?: { episode: number };
  idMal?: number;
  trailer?: Trailer;
  relations?: {
    edges: {
      relationType: string;
      node: {
        id: number;
        title: {
          romaji: string;
          english: string | null;
        };
        type: string;
        format: string;
        coverImage: {
          large: string;
        };
        relations?: {
          edges: {
            relationType: string;
            node: {
              id: number;
              title: {
                romaji: string;
                english: string | null;
              };
              type: string;
              format: string;
              coverImage: {
                large: string;
              };
            };
          }[];
        };
      };
    }[];
  };
  recommendations?: Recommendations;
  isAdult?: boolean;
}

export interface TmdbCast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface TmdbShowResult {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
}

export interface TmdbImage {
  file_path: string;
}

export interface TmdbShowDetails {
  id: number;
  name: string;
  overview: string;
  backdrop_path: string | null;
  seasons?: any[];
  credits: {
    cast: TmdbCast[];
  };
  similar: {
    results: TmdbShowResult[];
  };
  recommendations: {
    results: TmdbShowResult[];
  };
  images: {
    backdrops: TmdbImage[];
    logos: TmdbImage[];
  };
}

export interface Episode {
  id: string;
  number: number;
  title?: string;
  image?: string;
  description?: string;
  isFiller?: boolean;
  hasSub?: boolean;
  hasDub?: boolean;
}

export interface StreamSource {
  url: string;
  type: string;
  server?: string;
  embedUrl?: string;
  subtitles?: Subtitle[];
}

export interface StreamData {
  stream_url?: string;
  subtitles?: Subtitle[];
  streams?: StreamSource[];
  allServers?: { name?: string; embed: string }[];
}

export interface ServerInstance {
  id: string;
  name: string;
  type: string;
  url: string;
  provider: string;
  subType: string;
  subtitles?: Subtitle[];
}
