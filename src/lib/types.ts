import { type Generated } from 'kysely';

export interface Game {
	id: number;
	name: string;
	first_release_date: Date;
	early_access_exit_date?: Date;
	early_access: boolean;
	copies_sold: number;
	price: number;
	revenue: number;
	avg_playtime: number;
	review_score: number;
	publisher_class: string;
}

export interface Publisher {
	id: Generated<number>;
	name: string;
}

export interface Developer {
	id: Generated<number>;
	name: string;
}

export interface Genre {
	id: Generated<number>;
	name: string;
}

export interface Tag {
	id: Generated<number>;
	name: string;
}

export interface Feature {
	id: Generated<number>;
	name: string;
}

export interface Language {
	id: Generated<number>;
	name: string;
}

export interface GamePublisher {
	game_id: number;
	publisher_id: number;
}

export interface GameDeveloper {
	game_id: number;
	developer_id: number;
}

export interface GameGenre {
	game_id: number;
	genre_id: number;
}

export interface GameTag {
	game_id: number;
	tag_id: number;
}

export interface GameFeature {
	game_id: number;
	feature_id: number;
}

export interface GameLanguage {
	game_id: number;
	language_id: number;
}

export interface Database {
	games: Game;
	publishers: Publisher;
	developers: Developer;
	genres: Genre;
	tags: Tag;
	features: Feature;
	languages: Language;
	game_publishers: GamePublisher;
	game_developers: GameDeveloper;
	games_genres: GameGenre;
	games_tags: GameTag;
	games_features: GameFeature;
	games_languages: GameLanguage;
}
