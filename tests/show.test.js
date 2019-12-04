const request = require('supertest');
const app = require('../src/app');

test('Should search for a show', async () => {
	const response = await request(app)
		.post('/shows/search?page=1')
		.send({
			show: 'blue bloods'
		})
		.expect(200);
	expect(response.body.series.length).not.toBe(0);
	expect(response.body.page).toBe(1);
});

test('Should not be able to find show', async () => {
	await request(app)
		.post('/shows/search?page=1')
		.send({
			show: 'this_show_does_not_exist'
		})
		.expect(404);
});

test('Should return the nth page of a searched show', async () => {
	const showObj = { show: 'suits' };
	let response = null;
	let pages = null,
		page = null;

	response = await request(app)
		.post('/shows/search?page=1')
		.send(showObj)
		.expect(200);

	pages = response.body.pages;
	page = Math.floor(Math.random() * pages + 1);

	response = await request(app)
		.post(`/shows/search?page=${page}`)
		.send(showObj)
		.expect(200);
	expect(response.body.page).toBe(page);
});
