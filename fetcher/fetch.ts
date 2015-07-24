import fs = require('fs');
import https = require('https');


interface Parameters {
	[s: string]: string;
}

let rateLimit: number;
function githubRequest(prefix: string, owner: string, repo: string, path: string, params: Parameters, done: (data: string) => void) {
	rateLimit--;

	if(rateLimit === 0) {
		console.log('Aborting because we are about to hit the rate limit');
	}

	let oath = JSON.parse(fs.readFileSync('../../search-auth.json', 'utf-8'));
	params['client_id'] = oath['client-id'];
	params['client_secret'] = oath['client-secret'];

	let parts = [prefix, owner, repo, path].filter(s => !!s);
	let paramStr = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');

	let options = {
		host: 'api.github.com',
		path: '/' + parts.join('/') + '?' + paramStr,
		headers: {
			'User-Agent': 'RyanCavanaugh',
			'Accept': 'text/json',
		},
		method: 'GET'
	}
	https.get(options, res => {
		let data = '';
		res.on('data', d => {
			data = data + d;
		});
		res.on('end', () => {
			done(data);
		});
	});
}

githubRequest('rate_limit', undefined, undefined, undefined, {}, rateLimitStr => {
	let rates = JSON.parse(rateLimitStr);
	rateLimit = rates['rate']['remaining'];
	console.log('Started up; remaining rate limit = ' + rateLimit);
});

function fetchPage(pageNumber: number, done: (data: Issue[]) => void) {
	let params: Parameters = {};
	params['sort'] = 'updated';
	params['per_page'] = '100';
	params['state'] = 'all';
	params['page'] = pageNumber.toString();

	githubRequest('repos', 'Microsoft', 'TypeScript', 'issues', params, (issueStr: string) => {
		let issuesJson = JSON.parse(issueStr);
		done(issuesJson);
	})
};


function byUpdateTime(lhs: Issue, rhs: Issue) {
	return Date.parse(rhs.updated_at) - Date.parse(lhs.updated_at);
}

let dataFile = 'issues.json';
let issuesArray: Issue[] = [];

function save() {
	if(fs.existsSync(dataFile)) {
		let tmp = dataFile + '.tmp';
		let old = dataFile + '.old';
		fs.writeFileSync(tmp, JSON.stringify(issuesArray));
		fs.renameSync(dataFile, old);
		fs.renameSync(tmp, dataFile);
		fs.unlinkSync(old);

	} else {
		fs.writeFileSync(dataFile, JSON.stringify(issuesArray));
	}
}

if (fs.existsSync(dataFile)) {
	issuesArray = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
	console.log("Read " + issuesArray.length + ' issues from disk');
}
issuesArray.sort(byUpdateTime);

function fetchUpdatedIssues(completed: () => void) {
	let page = 1;
	function nextPage() {
		console.log('Fetch page #' + page);
		fetchPage(page, newIssues => {
			let done = newIssues.length === 0;
			// Merge in the new issues
			newIssues.forEach(issue => {
				// Do we already have a copy of this issue?
				let index = -1;
				for (var i = 0; i < issuesArray.length; i++) {
					if (issuesArray[i].number === issue.number) {
						index = i;
						break;
					}
				}
				if (index === -1) {
					// Didn't have it before
					issuesArray.push(issue);
				} else {
					// Maybe we're done?
					if (issuesArray[index].updated_at === issue.updated_at) {
						done = true;
					} else {
						// Update the array
						issuesArray[index] = issue;
					}
				}

			});

			// Save
			save();

			if (!done) {
				page++;
				nextPage();
			} else {
				completed();
			}
		});
	}
	// Keep fetching issues by their update time until we find some overlap with the existing array
	nextPage();
}

function fetchCommentsForIssue(id: number, completed: (data: Comment[]) => void) {
	let page = 1;
	let result: Comment[] = [];

	function fetchNext() {
		let pageSize = 100;
		let params: Parameters = {};
		params['per_page'] = pageSize.toString();
		params['page'] = page.toString();
		githubRequest('repos', 'Microsoft', 'TypeScript', 'issues/' + id + '/comments', params, dataStr => {
			let data = JSON.parse(dataStr);
			result = result.concat(data);
			if (data.length < pageSize) {
				completed(result);
			} else {
				page++;
				fetchNext();
			}
		});
	}
	fetchNext();
}

function fetchComments(completed: () => void) {
	let done = false;

	function getComments(issue: Issue) {
		fetchCommentsForIssue(issue.number, comments => {
			console.log('Downloaded ' + comments.length + ' comments for ' + issue.number);
			issue.fetchedComments = comments;
			save();
			next();
		});
	}

	function next() {
		let didAnything = false;
		for (var i = 0; i < issuesArray.length; i++) {
			issuesArray[i].fetchedComments = issuesArray[i].fetchedComments || [];
			if (issuesArray[i].fetchedComments.length < issuesArray[i].comments) {
				console.log('Fetching comments for ' + issuesArray[i].number + ', expect to get ' + issuesArray[i].comments);
				getComments(issuesArray[i]);
				didAnything = true;
				break;
			}
		}

		if(!didAnything) {
			completed();
		}
	}
	next();
}

console.log('Updating our issue list');
fetchUpdatedIssues(() => {
	console.log('Done fetching issues; fetching comments now');
	fetchComments(() => {
		console.log('Done fetching comments');
	})
});
