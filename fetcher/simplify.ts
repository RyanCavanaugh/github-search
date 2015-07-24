import fs = require('fs');

function produceKeywordMap(issues: Issue[]) {
	// A map from the search term to a map from the issue id to 'true'
	let keywords: { [key: string]: { [numbr: number]: boolean; } } = {};
	issues.forEach((issue, idx) => {
		if (idx % 200 === 0) console.log('Constructing keywords... (' + idx + ' of ' + issues.length + ')');

		// Adds a term to the current issue
		function add(term: string) {
			if (keywords[term] === undefined) keywords[term] = {};
			keywords[term][issue.number] = true;

		}

		// Registers a string under the given prefix, optionally splitting it by word boundaries (the default)
		function register(prefix: string, data: string, split = true) {
			let words = split ? (data.match(/\w+/g) || []) : [data];
			words = words.map(w => w.toLowerCase());

			for (var j = 0; j < words.length; j++) {
				add(prefix + ':' + words[j]);
				if (j < words.length - 1) {
					add(prefix + ':' + words[j] + ' ' + words[j + 1]);
				}
				if (j < words.length - 2) {
					add(prefix + ':' + words[j] + ' ' + words[j + 1]) + ' ' + words[j + 2];
				}
			}
		}

		register('term', issue.title);
		register('title', issue.title);
		register('term', issue.body);
		issue.fetchedComments.forEach(comment => {
			register('comment', comment.body);
		});

		register('state', issue.state);
		issue.labels.forEach(label => {
			register('label', label.name, false);
		});

		register('milestone', issue.milestone ? issue.milestone.title : 'none', false);
	});

	// Converts the number -> boolean lookups to arrays of numbers
	function demapify() {
		let result: { [term: string]: number[] } = {};
		Object.keys(keywords).forEach(kw => {
			result[kw] = Object.keys(keywords[kw]).map(id => +id);
			result[kw].sort();
		});
		return result;
	}

	console.log('Collected ' + Object.keys(keywords).length + ' keywords');

	let simplified = demapify();

	return simplified;
}

function reduceIssues(issues: Issue[]) {
	function reduce(i: Issue): MinimalIssue {
		return {
			assignedTo: i.assignee ? i.assignee.login : '',
			body: i.body.substr(0, 250),
			comments: i.comments,
			createdAt: Date.parse(i.created_at),
			labels: i.labels,
			loggedByAvatar: i.user.avatar_url,
			loggedByName: i.user.login,
			milestone: i.milestone ? i.milestone.title : '',
			number: i.number,
			state: i.state,
			title: i.title,
			updatedAt: Date.parse(i.updated_at)
		};
	}

	return issues.map(reduce);
}

function main() {
	// Load up the data file
	let data: Issue[] = JSON.parse(fs.readFileSync('issues_copy.json', 'utf-8'));
	console.log('Loaded ' + data.length + ' issues');
	// Take 10 for debug purposes
	// data = data.slice(0, 10);
	console.log('Trimmed to ' + data.length);

	let simplified = produceKeywordMap(data);
	fs.writeFile('keywords.json', JSON.stringify(simplified));
	fs.writeFile('issues_simplified.json', JSON.stringify(reduceIssues(data)));
}

main();