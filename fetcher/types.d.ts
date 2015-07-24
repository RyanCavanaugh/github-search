// Not complete
interface User {
	login: string;
	avatar_url: string;
}
interface Comment {
	user: User;
	created_at: string;
	updated_at: string;
	body: string;
}
interface Issue {
	id: number;
	number: number;
	title: string;
	user: User;
	labels: {
		name: string;
		color: string;
	}[];
	state: string;
	assignee: User;
	milestone: {
		title: string;
	}
	created_at: string;
	updated_at: string;
	closed_at: string;
	comments: number;
	fetchedComments: Comment[];
	body: string;
}

interface MinimalIssue {
	number: number;
	title: string;
	body: string;
	
	loggedByName: string;
	loggedByAvatar: string;
	assignedTo: string;

	comments: number;

	state: string;
	milestone: string;

	createdAt: number;
	updatedAt: number;
	labels: { name: string; color: string; }[];
}
