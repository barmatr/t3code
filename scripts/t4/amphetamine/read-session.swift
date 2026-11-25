import AppKit
import Carbon

let eventClass: AEEventClass = 0x616d7068 // amph
let eventID: AEEventID = 0x5354526d // STRm, session time remaining

if let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.if.Amphetamine")
    .first(where: { !$0.isTerminated }) {
    // Address the current process directly. A stopped app must never be launched by a probe.
    let target = NSAppleEventDescriptor(processIdentifier: app.processIdentifier)
    let askForPermission = CommandLine.arguments.dropFirst() == ["--authorize"]
    guard let address = target.aeDesc else { exit(1) }
    let permission = AEDeterminePermissionToAutomateTarget(address, eventClass, eventID, askForPermission)
    guard permission == noErr else {
        fputs("Apple Events: \(permission)\n", stderr)
        exit(1)
    }

    let event = NSAppleEventDescriptor(
        eventClass: eventClass,
        eventID: eventID,
        targetDescriptor: target,
        returnID: AEReturnID(kAutoGenerateReturnID),
        transactionID: AETransactionID(kAnyTransactionID)
    )
    do {
        let reply = try event.sendEvent(options: [.waitForReply, .neverInteract], timeout: 2)
        guard (reply.paramDescriptor(forKeyword: AEKeyword(keyErrorNumber))?.int32Value ?? 0) == 0,
            let result = reply.paramDescriptor(forKeyword: AEKeyword(keyDirectObject)),
            let seconds = result.coerce(toDescriptorType: DescType(typeSInt32))
        else {
            exit(1)
        }
        print(seconds.int32Value)
    } catch {
        exit(1)
    }
} else {
    print("closed")
}
