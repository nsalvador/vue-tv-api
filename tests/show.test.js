const request = require('supertest');
const app = require('../src/app');
const Show = require('../src/models/show');

describe('/shows/search route', () => {
	test('Should search for a show', async () => {
		const response = await request(app)
			.post('/shows/search')
			.send({
				show: 'blue bloods'
			})
			.expect(200);
		expect(response.body.series.length).not.toBe(0);
		expect(response.body.page).toBe(1);
	});

	test('Should not be able to find show', async () => {
		await request(app)
			.post('/shows/search')
			.send({
				show: 'this_show_does_not_exist'
			})
			.expect(404);
	});

	test('Should return the nth page of a searched show', async () => {
		const page = 5;
		const response = await request(app)
			.post(`/shows/search?page=${page}`)
			.send({
				show: 'suits'
			})
			.expect(200);
		expect(response.body.page).toBe(page);
	});
});
