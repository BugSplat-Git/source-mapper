import {StackConverter} from '../src/stackconverter';


describe('StackConverter tests', () => {
    describe('convert', () => {
        test('test converting an empty stack', async () => {
            const stackConverter = new StackConverter('empty-map.map');
            const initResults = await stackConverter.init();
            expect(initResults)
            const newStack = stackConverter.convert('');
            expect(newStack).toEqual('');
        })
    });
})
