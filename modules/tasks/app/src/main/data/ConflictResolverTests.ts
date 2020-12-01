import { TaskGroup } from "./TaskGroup";
import { TaskGroupConflictResolver } from "./TaskGroupConflictResolver";
import { ConflictResolutionResult, ConflictResolutionStatus } from "./ConflictResolver";

export class ConflictResolverTests {
    
    static run() {
        this.test1();
        this.test2();
        this.test3();
    }
    
    static test1() {
        // Unresolved conflict - both changed the name
        let orig = new TaskGroup();
        orig.setDetached(false);
        orig.setId("123");
        orig.setName("test1");
        orig.setProjectId("43fkfds943fkf");
        orig.setTaskIds(["004", "034"]);
        
        let first = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        first.setName("xyz");
        
        let second = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        second.setName("add");
        
        let resolver = new TaskGroupConflictResolver(orig, first, second);
        this.printResult("test1", resolver.resolve());
    }
    
    static test2() {
        // Resolved conflict - different property was changed
        let orig = new TaskGroup();
        orig.setDetached(false);
        orig.setId("123");
        orig.setName("test1");
        orig.setProjectId("43fkfds943fkf");
        orig.setTaskIds(["004", "034"]);
        
        let first = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        first.setProjectId("xyz");
        
        let second = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        second.setName("add");
        
        let resolver = new TaskGroupConflictResolver(orig, first, second);
        this.printResult("test2", resolver.resolve());
    }
    
    static test3() {
        // Resolved conflict - both modified an array
        let orig = new TaskGroup();
        orig.setDetached(false);
        orig.setId("123");
        orig.setName("test1");
        orig.setProjectId("43fkfds943fkf");
        orig.setTaskIds(["004", "034"]);
        
        let first = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        first.setTaskIds(["004", "001"]);
        
        let second = new TaskGroup(JSON.parse(JSON.stringify(orig)));
        second.setTaskIds(["004", "123", "034"]);
        
        let resolver = new TaskGroupConflictResolver(orig, first, second);
        this.printResult("test2", resolver.resolve());
    }
    
    static printResult(testName: string, result: ConflictResolutionResult<TaskGroup>) {
        let status = ConflictResolutionStatus[result.status];
        console.log({ testName, status, resolvedObject: result.resolvedObject });
    }
    
}
