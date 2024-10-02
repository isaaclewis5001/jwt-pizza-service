const withApp = require('./withApp');
const { loginUser, defaultAdmin, testUsers, registerUser } = require('./authUtils');
const { createFranchise, testFranchises, deleteFranchise, listAllFranchises, listUserFranchises } = require('./franchiseUtils');

test('franchise api', async () => {
    await withApp(async (app) => {
        const adminLogin = await loginUser(app, defaultAdmin);
        const diner1Login = await registerUser(app, testUsers[0]);
        const diner2Login = await registerUser(app, testUsers[1]);
        
        await createFranchise(app, diner1Login.token, testFranchises[0], 403);
        const franchise1 = await createFranchise(app, adminLogin.token, testFranchises[0]);
        expect(franchise1).toMatchObject({
            admins: testFranchises[0].admins
        });

        await createFranchise(app, adminLogin.token, testFranchises[1]);

        const allFranchises = (await listAllFranchises(app)).map(x => x.name);
        expect(allFranchises).toContain(testFranchises[0].name);
        expect(allFranchises).toContain(testFranchises[1].name);

        expect(await listUserFranchises(app, diner1Login.token, diner1Login.user.id))
            .toMatchObject([{name: testFranchises[0].name}]);
        
        expect(await listUserFranchises(app, adminLogin.token, diner1Login.user.id))
            .toMatchObject([{name: testFranchises[0].name}]);

        expect(await listUserFranchises(app, diner2Login.token, diner1Login.user.id)).toEqual([]);

        

        await deleteFranchise(app, diner1Login.token, franchise1.id, 403);
        await deleteFranchise(app, adminLogin.token, franchise1.id);

    });
})

